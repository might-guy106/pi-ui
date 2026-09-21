import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, keyText } from "@earendil-works/pi-coding-agent";
import { Container, getKeybindings, Key, matchesKey, SelectList, Spacer, Text, wrapTextWithAnsi, type Component, type SelectItem, type TUI } from "@earendil-works/pi-tui";

/**
 * Marks a user message component. Set by the user-message patch in
 * `messages/user-prefix.ts`, so it survives module copies created by jiti.
 */
export const PI_UI_USER_MESSAGE = Symbol.for("pi-ui.user-message");

const TOC_COMMAND = "toc";
const MAX_LABEL_LENGTH = 72;
const MIN_VISIBLE_ENTRIES = 5;

// Arrow/page key names are compacted the same way pi's own session tree does it.
const COMPACT_KEY_NAMES: Record<string, string> = {
	up: "↑",
	down: "↓",
	left: "←",
	right: "→",
	pageUp: "pgup",
	pageDown: "pgdn",
};

function compactKeyText(binding: Parameters<typeof keyText>[0]): string {
	return keyText(binding).replace(/\b(pageUp|pageDown|up|down|left|right)\b/g, (match) => COMPACT_KEY_NAMES[match] ?? match);
}

/** Key display form pi uses for its own hint lines ("escape/ctrl+c" → "Escape/ctrl+c"). */
function capitalizeKeyText(text: string): string {
	return text
		.split("/")
		.map((binding) => binding.split("+").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("+"))
		.join("/");
}

type TranscriptPort = {
	scrollView: any;
	document: Component;
	width: number;
};

type TocEntry = {
	component: Component;
	text: string;
	row: number;
};

let activeTui: TUI | undefined;

/** The live TUI proxy, captured from the editor factory on session start. */
export function setTableOfContentsTui(tui: TUI | undefined): void {
	activeTui = tui;
}

function isUserMessageComponent(node: any): boolean {
	if (!node) return false;
	if (node[PI_UI_USER_MESSAGE] === true) return true;
	// Fall back to the constructor name: `instanceof` is unreliable for classes
	// loaded through a different module graph than pi core's.
	return node.constructor?.name === "UserMessageComponent";
}

function isContainerLike(node: any): node is Component & {
	children: unknown[];
	mouseLayout?: { width: number; children: Array<{ component: Component; height: number }> };
} {
	return Boolean(node) && Array.isArray(node.children) && typeof node.render === "function";
}

/** The fullscreen transcript scroll view and its document, when available. */
function resolveTranscript(tui: any): TranscriptPort | undefined {
	if (!tui || tui.mode !== "fullscreen") return undefined;
	const scrollView = typeof tui.getPrimaryScrollView === "function" ? tui.getPrimaryScrollView() : undefined;
	if (!scrollView || typeof scrollView.scrollTo !== "function") return undefined;
	const document = Array.isArray(scrollView.children) ? scrollView.children[0] : undefined;
	if (!isContainerLike(document)) return undefined;

	const columns = Number(tui.terminal?.columns ?? 0);
	if (!Number.isFinite(columns) || columns <= 0) return undefined;
	const preferred = typeof scrollView.getContentWidth === "function" ? Number(scrollView.getContentWidth(columns)) : columns;
	const fallback = Number.isFinite(preferred) && preferred > 0 ? preferred : columns;

	// The layout renders the transcript at the terminal width minus any reserved
	// scrollbar column. Verify against the height the layout last computed so row
	// offsets cannot drift; fall back to the preferred width when it is unknown.
	const contentHeight = Number(scrollView.contentHeight);
	if (!(contentHeight > 0)) return { scrollView, document, width: fallback };

	for (const candidate of new Set([fallback, columns, Math.max(1, columns - 1), Math.max(1, columns - 2)])) {
		if (!Number.isFinite(candidate) || candidate <= 0) continue;
		if (document.render(candidate).length === contentHeight) return { scrollView, document, width: candidate };
	}
	return { scrollView, document, width: fallback };
}

/**
 * User messages in transcript order with the content line each one starts on.
 *
 * Row offsets are the heights of the sibling components above each message, read
 * from the container render maps so they line up with `scrollTo`. Containers
 * that do not render as a plain concatenation of their children (padding, gaps,
 * cropped stacks) are not descended into: a message inside one is left out
 * rather than reported with an offset that would jump to the wrong line.
 */
function collectUserMessages(document: Component, width: number): TocEntry[] {
	const entries: TocEntry[] = [];

	const visit = (node: any, row: number): void => {
		if (!node || typeof node.render !== "function") return;
		if (isUserMessageComponent(node)) {
			entries.push({ component: node, text: String(node.text ?? ""), row });
			return;
		}
		if (!isContainerLike(node)) return;

		// Render first: this refreshes the container's render map, so the heights
		// below describe the lines that are drawn right now at this width.
		const ownHeight = Number(node.render(width)?.length ?? 0);
		const layout = node.mouseLayout;
		const heights = node.children.map((child: any, index: number) => {
			const recorded = layout && Array.isArray(layout.children) ? Number(layout.children[index]?.height) : Number.NaN;
			if (Number.isFinite(recorded) && recorded >= 0) return recorded;
			return Number(child?.render?.(width)?.length ?? 0);
		});
		if (heights.reduce((total, height) => total + height, 0) !== ownHeight) return;

		let cursor = row;
		for (let index = 0; index < node.children.length; index++) {
			visit(node.children[index], cursor);
			cursor += heights[index]!;
		}
	};

	visit(document, 0);
	return entries;
}

function messageLabel(text: string): string {
	const firstLine = text.replace(/\r/g, "").split("\n").find((line) => line.trim().length > 0) ?? "";
	const cleaned = firstLine.replace(/\s+/g, " ").trim();
	if (!cleaned) return "(empty message)";
	return cleaned.length > MAX_LABEL_LENGTH ? `${cleaned.slice(0, MAX_LABEL_LENGTH - 1)}…` : cleaned;
}

/**
 * Key hints for the bottom of the panel, styled like pi's settings hint line:
 * dim, two-space indent, items separated by a middot, wrapped to the width.
 * The search row above already labels itself, so it is not repeated here.
 */
function createTocHint(theme: any): Component {
	return {
		invalidate() {},
		render(width: number): string[] {
			const items = [
				`${compactKeyText("tui.select.up")}${compactKeyText("tui.select.down")} move`,
				`${capitalizeKeyText(keyText("tui.select.confirm"))} jump`,
				`${capitalizeKeyText(keyText("tui.select.cancel"))} close`,
			];
			const text = items.join(" · ");
			const available = Math.max(1, width - 2);
			return wrapTextWithAnsi(text, available).map((line) => theme.fg("dim", `  ${line}`));
		},
	};
}

/**
 * SelectList filters on the item value prefix, but a table of contents needs
 * substring matching anywhere in the label. Set the filtered list directly and
 * fall back to the public prefix filter if that field ever changes shape.
 */
function applySelectListFilter(list: SelectList, items: readonly SelectItem[], query: string): void {
	const needle = query.trim().toLowerCase();
	const filtered = needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : [...items];
	const internal = list as unknown as { filteredItems?: unknown; selectedIndex?: number };
	if (Array.isArray(internal.filteredItems)) {
		internal.filteredItems = filtered;
		internal.selectedIndex = 0;
		return;
	}
	list.setFilter(query);
}

/**
 * Full-width panel mounted in the editor dock, mirroring pi's session tree:
 * border, title, help, search line, border, list, border.
 */
function createTocPanel(options: {
	theme: any;
	entries: readonly TocEntry[];
	rows: number;
	onSelect: (entry: TocEntry) => void;
	onCancel: () => void;
}): Component {
	const { theme, entries } = options;
	const container = new Container();
	const border = (text: string) => theme.fg("border", text);

	// The label doubles as the searchable value, so filtering sees the message
	// text rather than the numeric index behind it.
	const items: SelectItem[] = entries.map((entry, index) => {
		const label = `#${index + 1}  ${messageLabel(entry.text)}`;
		return { value: label, label };
	});
	const maxVisible = Math.max(MIN_VISIBLE_ENTRIES, Math.floor(Math.max(1, options.rows) / 2));
	const list = new SelectList(items, maxVisible, {
		selectedPrefix: (text) => theme.fg("accent", text),
		selectedText: (text) => theme.fg("accent", text),
		description: (text) => theme.fg("muted", text),
		scrollInfo: (text) => theme.fg("muted", text),
		noMatch: () => theme.fg("muted", "  No matching messages"),
	});
	list.setSelectedIndex(Math.max(0, entries.length - 1));
	list.onSelect = (item) => {
		const entry = entries[items.indexOf(item)];
		if (entry) options.onSelect(entry);
	};
	list.onCancel = () => options.onCancel();

	let query = "";
	const searchLine = new Text("", 1, 0);
	const renderSearchLine = () => {
		const prompt = theme.fg("muted", "Type to search:");
		searchLine.setText(`  ${prompt}${query ? ` ${theme.fg("accent", query)}` : ""}`);
	};
	renderSearchLine();

	container.addChild(new Spacer(1));
	container.addChild(new DynamicBorder(border));
	container.addChild(new Text(theme.bold(`  Table of Contents · ${entries.length} user ${entries.length === 1 ? "message" : "messages"}`), 1, 0));
	container.addChild(searchLine);
	container.addChild(new DynamicBorder(border));
	container.addChild(new Spacer(1));
	container.addChild(list);
	container.addChild(new Spacer(1));
	container.addChild(createTocHint(theme));
	container.addChild(new DynamicBorder(border));

	return {
		render: (width: number) => container.render(width),
		invalidate: () => container.invalidate(),
		// Forward clicks and wheel to the list: the panel wraps the container, and
		// pi-tui dispatches mouse events to the mounted component only.
		handleMouse: (event: any) => container.handleMouse(event),
		handleInput: (data: string) => {
			const keybindings = getKeybindings();
			const isNavigation =
				keybindings.matches(data, "tui.select.up") ||
				keybindings.matches(data, "tui.select.down") ||
				keybindings.matches(data, "tui.select.confirm") ||
				keybindings.matches(data, "tui.select.cancel");
			if (isNavigation) {
				list.handleInput(data);
				return;
			}
			if (matchesKey(data, Key.backspace) || data === "\b") {
				if (!query) return;
				query = query.slice(0, -1);
			} else if (data.length > 0 && !data.startsWith("\x1b") && [...data].every((char) => char.charCodeAt(0) >= 32)) {
				query += data;
			} else {
				return;
			}
			renderSearchLine();
			applySelectListFilter(list, items, query);
		},
	};
}

async function openTableOfContents(ctx: ExtensionCommandContext): Promise<void> {
	const tui = activeTui as any;
	const port = resolveTranscript(tui);
	if (!port) {
		ctx.ui.notify("Jump to a message needs the fullscreen TUI (set TUI mode to fullscreen in /settings).", "warning");
		return;
	}

	const entries = collectUserMessages(port.document, port.width);
	if (entries.length === 0) {
		ctx.ui.notify("No user messages in this session yet.", "info");
		return;
	}

	// Prefer the handle the panel factory hands over for the re-measure: it is
	// read while the panel is open, so it cannot be stale.
	let liveTui: any = tui;
	const selected = await ctx.ui.custom<TocEntry | null>((panelTui, theme, _keybindings, done) => {
		liveTui = panelTui;
		return createTocPanel({
			theme,
			entries,
			rows: Number((panelTui as any)?.terminal?.rows ?? 0),
			onSelect: (entry) => done(entry),
			onCancel: () => done(null),
		});
	});
	if (!selected) return;

	// Re-measure after the panel closes: output that arrived while the list was
	// open would otherwise shift the target row.
	const current = resolveTranscript(liveTui);
	if (!current) return;
	const row = collectUserMessages(current.document, current.width).find((entry) => entry.component === selected.component)?.row;
	if (row === undefined) return;

	current.scrollView.scrollTo(row);
	liveTui.requestRender();
}

export function registerTableOfContentsCommand(pi: ExtensionAPI): void {
	pi.registerCommand(TOC_COMMAND, {
		description: "Table of contents — jump the transcript to a user message",
		handler: async (_args, ctx) => {
			await openTableOfContents(ctx);
		},
	});
}
