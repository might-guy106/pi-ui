import {
	BranchSummaryMessageComponent,
	CompactionSummaryMessageComponent,
	CustomEditor,
	CustomMessageComponent,
	InteractiveMode,
	SkillInvocationMessageComponent,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { makeWelcomeHeader } from "./welcome.ts";
import { loadConfig } from "./config.ts";
import { BoxEditor } from "./editor/box-editor.ts";
import { resolveUserZoneStyle, USER_ZONE_STYLE_NAMES } from "./editor/user-zone.ts";
import { createGitBranchFetcher, type GitBranchFetcher } from "./core/git-status.ts";
import { createAssistantSpeedTracker } from "./core/assistant-speed.ts";
import { setPresentationStyle } from "./tools/presentation/state.ts";
import { installCompactToolSpacing, setToolSpacingTheme } from "./tools/compact-tool-spacing.ts";
import { installDefaultBadge, setDefaultBadgeTheme } from "./tools/default-badge.ts";
import { installResumeToolRefresh } from "./tools/resume-tool-refresh.ts";
import { registerToolCallTags } from "./tools/register-tool-call-tags.ts";
import { installAssistantMessagePrefix } from "./messages/assistant-prefix.ts";
import { installUserMessagePrefix } from "./messages/user-prefix.ts";
import { installCoreMessageBlockStyling, setCoreMessageBlockTheme } from "./messages/core-message-blocks.ts";
import { installMarkdownCodeBlockRenderer } from "./messages/markdown-codeblock-renderer.ts";
import {
	beginAssistantStream,
	endAssistantStream,
	trackAssistantStreamMessage,
} from "./messages/assistant-streaming-state.ts";
import { setFullTheme } from "./theme/theme-extras.ts";
import { applyTerminalPageBackgroundOsc11 } from "./theme/terminal-bg.ts";
import { suppressStartupModelScopeLog } from "./startup.ts";
import {
	createMergedWorkingLoader,
	workingStateForAssistantMessage,
	type MergedWorkingLoaderController,
} from "./loader.ts";
import { installFooterStatsPatch, getFooterStatusLine, getFooterTokenUsageLine } from "./footer-patch.ts";

interface SessionState {
	loader?: MergedWorkingLoaderController;
	fetchBranch?: GitBranchFetcher;
	speedTracker?: ReturnType<typeof createAssistantSpeedTracker>;
	requestRender?: () => void;
	restoreTerminalBackground?: () => void;
	stale: boolean;
}

let session: SessionState | undefined;

// Tool tag overrides (bash/read/write/edit/ls/find/grep) register once per
// process; pi.registerTool persists across sessions within the same run.
let toolTagsRegistration: Promise<void> | undefined;

function ensureToolCallTagsRegistered(pi: ExtensionAPI): Promise<void> {
	toolTagsRegistration ??= registerToolCallTags(pi).catch((error) => {
		toolTagsRegistration = undefined;
		throw error;
	});
	return toolTagsRegistration;
}

// Keep theme-derived colors in sync when the user switches themes. There is no
// official theme-change event, so wrap the editor border updater (private, guarded)
// the same way upstream does — symbol-marked so extension reloads don't stack it.
function installThemeSync(getTheme: () => unknown): void {
	const proto = InteractiveMode.prototype as any;
	const original = proto.updateEditorBorderColor;
	if (typeof original !== "function" || original.__piUiThemeSync) return;
	const wrapped = function (this: unknown, ...args: unknown[]) {
		setFullTheme(getTheme(), true);
		return original.apply(this, args);
	};
	(wrapped as any).__piUiThemeSync = true;
	proto.updateEditorBorderColor = wrapped;
}

function isStaleContextError(error: unknown): boolean {
	return error instanceof Error && error.message.includes("stale after session replacement or reload");
}

export function teardownSessionUI(): void {
	endAssistantStream();
	session?.restoreTerminalBackground?.();
	session?.loader?.dispose();
	session = undefined;
}

export async function setupSessionUI(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
	// A newer session_start supersedes any in-flight state from a previous one.
	teardownSessionUI();
	const state: SessionState = { stale: false };
	session = state;

	const config = loadConfig();
	const userZoneStyle = resolveUserZoneStyle(config.userZoneStyle);
	const useBoxEditor = USER_ZONE_STYLE_NAMES.includes(userZoneStyle.name as (typeof USER_ZONE_STYLE_NAMES)[number]);

	// Sync the terminal emulator's background to the theme page background
	// (OSC 11). Skipped on Windows/WSL unless forceOSC11 is set.
	suppressStartupModelScopeLog();

	if (useBoxEditor && config.footer) {
		// Hides pi's default footer and exposes token-usage/status lines
		// to the editor's user zone instead.
		installFooterStatsPatch();
	}

	// Tool presentation: badges for core tools, boxed default for the rest.
	setPresentationStyle(config.presentationStyle);
	installCompactToolSpacing();
	installDefaultBadge();
	installResumeToolRefresh(InteractiveMode);
	try {
		await ensureToolCallTagsRegistered(pi);
	} catch (error) {
		console.error("[pi-ui] tool tag registration failed:", error);
	}
	if (ctx.ui.getToolsExpanded() !== config.alwaysExpanded) {
		ctx.ui.setToolsExpanded(config.alwaysExpanded);
	}

	// Message presentation: prefixes, boxed core blocks, codeblock rail.
	setFullTheme(ctx.ui.theme, true);
	installThemeSync(() => ctx.ui.theme);
	installAssistantMessagePrefix(ctx.ui.theme);
	installUserMessagePrefix(ctx.ui.theme);
	installMarkdownCodeBlockRenderer();
	installCoreMessageBlockStyling({
		CompactionSummaryMessageComponent,
		SkillInvocationMessageComponent,
		BranchSummaryMessageComponent,
		CustomMessageComponent,
	});
	setDefaultBadgeTheme(ctx.ui.theme);
	setToolSpacingTheme(ctx.ui.theme);
	setCoreMessageBlockTheme(ctx.ui.theme);

	state.fetchBranch = createGitBranchFetcher(ctx.cwd, () => state.requestRender?.());
	state.speedTracker = createAssistantSpeedTracker();

	state.loader = createMergedWorkingLoader(ctx.ui, {
		messages: config.customWorkingMessage,
		onToneChange: () => state.requestRender?.(),
	});
	state.loader.configure();

	ctx.ui.setHeader((tui, theme) => makeWelcomeHeader(tui, theme, true));

	const readThinkingLevel = (): string | undefined => {
		try {
			return pi.getThinkingLevel();
		} catch (error) {
			if (isStaleContextError(error)) return undefined;
			throw error;
		}
	};
	let currentThinkingLevel = readThinkingLevel();

	const readContextUsage = () => {
		try {
			return ctx.getContextUsage();
		} catch (error) {
			if (isStaleContextError(error)) return undefined;
			throw error;
		}
	};

	const readModelInfo = () => {
		try {
			const model = ctx.model;
			return model
				? {
					provider: model.provider,
					id: model.id,
					name: (model as typeof model & { name?: string }).name,
					reasoning: model.reasoning,
					thinkingLevel: currentThinkingLevel,
				}
				: undefined;
		} catch (error) {
			if (isStaleContextError(error)) return undefined;
			throw error;
		}
	};

	if (useBoxEditor) {
		ctx.ui.setEditorComponent((tui, theme, kb) => {
			const uiTheme = (ctx.ui.theme ?? theme) as any;
			state.requestRender = () => tui.requestRender();
			// (Re)apply the terminal background sync with the current theme.
			state.restoreTerminalBackground?.();
			state.restoreTerminalBackground = applyTerminalPageBackgroundOsc11(uiTheme, (tui as any).terminal, { force: config.forceOSC11 });
			return new BoxEditor(
				tui,
				theme as any,
				kb,
				uiTheme,
				ctx.cwd,
				readContextUsage,
				readModelInfo,
				() => state.fetchBranch?.() ?? null,
				() => state.speedTracker?.getWordsPerSecond() ?? null,
				() => getFooterStatusLine(),
				() => "footer",
				userZoneStyle,
				config.inputBox.style,
				() => getFooterTokenUsageLine(),
			);
		});
	} else {
		ctx.ui.setEditorComponent((tui, theme, keybindings) => new CustomEditor(tui, theme as any, keybindings as any));
	}

	const runningToolCalls = new Set<string>();

	pi.on("before_agent_start", async () => {
		state.loader?.setState("working");
	});

	pi.on("agent_start", async () => {
		runningToolCalls.clear();
		state.loader?.start("working");
		state.requestRender?.();
	});

	pi.on("message_start", async (event) => {
		state.loader?.touch();
		state.speedTracker?.handleMessageStart(event.message);
		if (event.message.role === "assistant") {
			beginAssistantStream(event.message);
			if (runningToolCalls.size === 0) {
				state.loader?.setState(workingStateForAssistantMessage(event.message));
			}
		}
	});

	pi.on("message_update", async (event) => {
		state.loader?.touch();
		state.speedTracker?.handleMessageUpdate(event.message);
		if (event.message.role === "assistant") {
			trackAssistantStreamMessage(event.message);
			if (runningToolCalls.size === 0) {
				state.loader?.setState(workingStateForAssistantMessage(event.message));
			}
		}
	});

	pi.on("message_end", async (event) => {
		if (event.message.role === "assistant") endAssistantStream();
		state.speedTracker?.handleMessageEnd(event.message);
	});

	pi.on("tool_execution_start", async (event) => {
		runningToolCalls.add(event.toolCallId);
		state.loader?.setState("running");
	});

	pi.on("tool_execution_end", async (event) => {
		runningToolCalls.delete(event.toolCallId);
		// Keep the current label until the next live state begins.
	});

	pi.on("agent_end", async () => {
		endAssistantStream();
		runningToolCalls.clear();
		state.loader?.stop();
		// Reset the working message to default shortly after the run ends.
		setTimeout(() => {
			if (session === state && !state.stale) {
				try {
					ctx.ui.setWorkingMessage();
				} catch {
					// ctx may be stale after session replacement — ignore
				}
			}
		}, 2000);
		state.requestRender?.();
	});

	pi.on("thinking_level_select", async (event) => {
		currentThinkingLevel = event.level;
		state.requestRender?.();
	});
}
