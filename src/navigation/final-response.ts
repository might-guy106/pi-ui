// Focus mode: collapse everything in the transcript except the final response.
//
// The "final response" is the last text run of the last assistant message that
// has visible text — the answer after all thinking blocks and tool calls.
// Boundaries come from pi's own layout: user/assistant message components are
// top-level turns in the transcript document, tool executions are their
// siblings, and inside the message each text/thinking run is one child of
// contentContainer (mapped by getAssistantContentRuns).
//
// Collapsing never removes components — that would break streaming state,
// resize handling and selection. Each collapsed component keeps its place in
// the tree and just renders zero lines until the toggle restores it.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { getAssistantContentRuns } from "../messages/assistant-content-runs.ts";
import { loadConfig } from "../config.ts";
import { resolveTranscript } from "./table-of-contents.ts";

export const FINAL_RESPONSE_COMMAND = "final";
export const DEFAULT_FINAL_RESPONSE_SHORTCUT = "alt+g";

const COLLAPSED = Symbol.for("pi-ui.final-response.collapsed");
const COLLAPSIBLE = Symbol.for("pi-ui.final-response.collapsible");

let activeTui: any;

/** The live TUI, captured from the editor factory on session start. */
export function setFinalResponseTui(tui: any): void {
	activeTui = tui;
}

type CollapseState = {
	flagged: any[];
};

let state: CollapseState | null = null;

function isContainer(node: any): boolean {
	return Boolean(node) && Array.isArray(node.children) && typeof node.render === "function";
}

function isAssistantMessage(node: any): boolean {
	// Constructor name survives the separate module copies jiti creates.
	return Boolean(node) && node.constructor?.name === "AssistantMessageComponent";
}

function makeCollapsible(component: any): void {
	if (component[COLLAPSIBLE]) return;
	component[COLLAPSIBLE] = true;
	const baseRender = component.render.bind(component);
	component.render = (width: number): string[] => (component[COLLAPSED] ? [] : baseRender(width));
}

function setCollapsed(component: any, collapsed: boolean, flagged: any[]): void {
	makeCollapsible(component);
	if (component[COLLAPSED] === collapsed) return;
	component[COLLAPSED] = collapsed;
	if (collapsed) flagged.push(component);
	component.invalidate?.();
}

function containsTarget(node: any, target: any): boolean {
	if (node === target) return true;
	if (!isContainer(node)) return false;
	return node.children.some((child: any) => containsTarget(child, target));
}

/** Collapse every subtree that does not lead to `target`, at the highest level. */
function prune(node: any, target: any, flagged: any[]): void {
	if (!isContainer(node)) return;
	for (const child of node.children) {
		if (containsTarget(child, target)) {
			prune(child, target, flagged);
		} else {
			setCollapsed(child, true, flagged);
		}
	}
}

function hasVisibleText(messageComponent: any): boolean {
	const content = messageComponent?.lastMessage?.content;
	return Array.isArray(content) && content.some((block) => block?.type === "text" && typeof block.text === "string" && block.text.trim().length > 0);
}

/** Last assistant message with visible text, in transcript order. */
function findFinalMessage(root: any): any | null {
	const messages: any[] = [];
	const walk = (node: any): void => {
		if (isAssistantMessage(node)) {
			messages.push(node);
			return;
		}
		if (!isContainer(node)) return;
		for (const child of node.children) walk(child);
	};
	walk(root);
	for (let i = messages.length - 1; i >= 0; i--) {
		if (hasVisibleText(messages[i])) return messages[i];
	}
	return null;
}

/** The rendered child that holds the message's final text run. */
function finalTextChild(messageComponent: any): any | null {
	const runs = getAssistantContentRuns(messageComponent, messageComponent.lastMessage);
	for (let i = runs.length - 1; i >= 0; i--) {
		if (runs[i].kind !== "text") continue;
		return messageComponent.contentContainer?.children?.[runs[i].childIndex] ?? null;
	}
	return null;
}

function restore(tui: any): string {
	const flagged = state?.flagged ?? [];
	state = null;
	for (const component of flagged) {
		component[COLLAPSED] = false;
		component.invalidate?.();
	}
	const scrollView = tui?.getPrimaryScrollView?.();
	scrollView?.scrollToEnd?.();
	tui?.requestRender?.();
	return "Transcript restored";
}

function collapse(tui: any): string {
	const port = resolveTranscript(tui);
	if (!port) return "Focus mode needs fullscreen TUI mode";

	const message = findFinalMessage(port.document);
	if (!message) return "No response to focus on yet";
	if (message.isStreaming) return "Wait for the response to finish";

	const target = finalTextChild(message);
	if (!target) return "The last response has no final text";

	const flagged: any[] = [];
	prune(port.document, target, flagged);
	state = { flagged };
	port.scrollView.scrollTo(0);
	tui?.requestRender?.();
	return `Showing the final response (${flagged.length} blocks collapsed)`;
}

export function toggleFinalResponse(ctx: { ui?: { notify?: (message: string, type?: "info" | "warning" | "error") => void } }): void {
	const message = state ? restore(activeTui) : collapse(activeTui);
	ctx?.ui?.notify?.(message, "info");
}

export function registerFinalResponseCommand(pi: ExtensionAPI): void {
	pi.registerCommand(FINAL_RESPONSE_COMMAND, {
		description: "Collapse everything except the final response; run again to restore",
		handler: async (_args, ctx) => {
			toggleFinalResponse(ctx as any);
		},
	});
}

export function registerFinalResponseShortcut(pi: ExtensionAPI): void {
	const shortcut = loadConfig().finalResponseShortcut || DEFAULT_FINAL_RESPONSE_SHORTCUT;
	pi.registerShortcut(shortcut as any, {
		description: "Collapse everything except the final response (toggle)",
		handler: (ctx) => {
			toggleFinalResponse(ctx as any);
		},
	});
}