import { ToolExecutionComponent } from "@earendil-works/pi-coding-agent";

import { getPresentationDesign } from "./presentation/state.ts";
import { getReasonixCollapsedRowWidth } from "./presentation/reasonix-layout.ts";
import { isImageRenderLine, safeTruncateToWidth, safeVisibleWidth, toSingleRenderLine, trimTrailingRenderPadding } from "../render-budget.ts";
import { dropLeadingColumns, fgHex, stripAnsi } from "../theme/ansi.ts";
import { getThemeExtra } from "../theme/theme-extras.ts";

const PATCH_FLAG = "__piUiCompactToolSpacingPatched__";
const LEGACY_CHAIN_FLAG = "__piUiCompactToolSpacingLegacyChain__";
const PATCH_VERSION_KEY = "__piUiCompactToolSpacingPatchVersion__";
const RUNTIME_STATE_KEY = Symbol.for("pi-ui.compact-tool-spacing.runtime-state");
const PATCH_VERSION = 11;
// RUNTIME_STATE_KEY delegation shipped with wrapper version 10; older stamped
// wrappers (2-9) never read the delegate and still need to be wrapped over.
const DELEGATE_AWARE_PATCH_VERSION = 10;

type ToolSpacingRuntimeState = {
	usesReasonix(): boolean;
	normalizeReasonix(lines: string[], width: number, expanded: boolean): NormalizedToolRender;
	showDivider(): boolean;
	buildDivider(width: number): string;
};

/**
 * Normalized tool lines plus how many source lines were dropped at the head
 * and tail. The core component records its child hit-test map while rendering
 * the unnormalized lines, so the wrapper replays these drops onto that map to
 * keep mouse hit-testing aligned with what is actually drawn.
 */
type NormalizedToolRender = {
	lines: string[];
	dropLead: number;
	dropTail: number;
};

let cachedTheme: any = null;

export function setToolSpacingTheme(theme: any): void {
	cachedTheme = theme;
	cachedDividerWidth = -1;
}

function buildDividerLine(width: number): string {
	if (width <= 0) return "";
	const char = getThemeExtra(cachedTheme, "dividerChar");
	const color = getThemeExtra(cachedTheme, "dividerColor");
	const line = char.repeat(width);
	return cachedTheme ? fgHex(cachedTheme, color, line) : line;
}

function trimBounds(lines: string[]): { start: number; end: number } {
	let start = 0;
	let end = lines.length;
	while (start < end && stripAnsi(lines[start] ?? "").trim() === "") start++;
	while (end > start && stripAnsi(lines[end - 1] ?? "").trim() === "") end--;
	return { start, end };
}

const EMPTY_RENDER: NormalizedToolRender = { lines: [], dropLead: 0, dropTail: 0 };

/**
 * ToolExecutionComponent appends terminal image lines (kitty/iTerm2 escape
 * payloads) after the text content. stripAnsi() reduces them to empty strings,
 * so spacing normalization would silently trim them as blank lines. Split them
 * off (with their leading spacer) before normalizing and re-append after.
 */
function splitImageTail(lines: string[]): { content: string[]; tail: string[] } {
	const first = lines.findIndex(isImageRenderLine);
	if (first < 0) return { content: lines, tail: [] };
	let start = first;
	while (start > 0 && stripAnsi(lines[start - 1] ?? "").trim() === "") start--;
	return { content: lines.slice(0, start), tail: lines.slice(start) };
}

function appendImageTail(lines: string[], tail: string[]): string[] {
	if (tail.length === 0) return lines;
	let end = lines.length;
	while (end > 0 && stripAnsi(lines[end - 1] ?? "").trim() === "") end--;
	return [...lines.slice(0, end), ...tail, ""];
}

function isFullWidthDivider(line: string, width: number): boolean {
	const dividerChar = getThemeExtra(cachedTheme, "dividerChar");
	return Boolean(dividerChar) && stripAnsi(line) === dividerChar.repeat(width);
}

function reasonixEllipsis(): string {
	return cachedTheme?.fg?.("dim", " …") ?? " …";
}

function truncateReasonixLine(text: string, width: number): string {
	const content = trimTrailingRenderPadding(text);
	const rowWidth = Math.max(1, Math.floor(width));
	if (safeVisibleWidth(content) <= rowWidth) return content;
	return safeTruncateToWidth(content, rowWidth, reasonixEllipsis());
}

function colorReasonixConnector(line: string): string {
	const visible = stripAnsi(line);
	const connectorIndex = visible.indexOf("└─ ");
	if (connectorIndex < 0 || visible.slice(0, connectorIndex).trim().length > 0) return line;
	const remainder = dropLeadingColumns(line, connectorIndex + 3);
	const connector = cachedTheme?.fg?.("dim", "└─ ") ?? "└─ ";
	return `${" ".repeat(connectorIndex)}${connector}${remainder}`;
}

function formatReasonixMetricsLine(footerLine: string, width: number): string {
	const footer = toSingleRenderLine(footerLine).trimStart();
	const line = stripAnsi(footer).startsWith("└─ ") ? `  ${footer}` : `  └─ ${footer}`;
	return truncateReasonixLine(colorReasonixConnector(line), width);
}

export function normalizeReasonixToolLines(lines: string[], width: number, expanded: boolean): string[] {
	return normalizeReasonixRender(lines, width, expanded).lines;
}

function normalizeReasonixRender(lines: string[], width: number, expanded: boolean): NormalizedToolRender {
	const bounds = trimBounds(lines);
	const dropLead = bounds.start;
	const dropTail = lines.length - bounds.end;
	const content = lines.slice(bounds.start, bounds.end);
	let headerDrop = 0;
	while (content.length > 0 && isFullWidthDivider(content[0] ?? "", width)) {
		content.shift();
		headerDrop++;
	}
	if (content.length === 0) return EMPTY_RENDER;

	const rowWidth = expanded ? Math.max(1, width) : getReasonixCollapsedRowWidth(width);
	if (expanded) {
		content[0] = truncateReasonixLine(toSingleRenderLine(content[0] ?? ""), rowWidth);
		for (let index = 1; index < content.length; index++) {
			content[index] = truncateReasonixLine(colorReasonixConnector(content[index] ?? ""), rowWidth);
		}
		// The trailing spacer row replaces one dropped line.
		return { lines: [...content, ""], dropLead: dropLead + headerDrop, dropTail: Math.max(0, dropTail - 1) };
	}

	let footerIndex = -1;
	for (let index = content.length - 1; index > 0; index--) {
		const plain = stripAnsi(content[index] ?? "").trimStart();
		if (!plain.includes("◷") && !(content.length === 2 && plain.startsWith("└─ "))) continue;
		footerIndex = index;
		break;
	}

	const outputIndex = content.findIndex((line, index) => index > 0 && stripAnsi(line).trimStart().startsWith("└─ "));
	const headerEnd = outputIndex >= 0 ? outputIndex : footerIndex >= 0 ? footerIndex : content.length;
	const headerRows = content.slice(0, Math.max(1, headerEnd)).map((line) => truncateReasonixLine(toSingleRenderLine(line), rowWidth));
	if (footerIndex < 0) return { lines: [...headerRows, ""], dropLead: dropLead + headerDrop, dropTail: Math.max(0, dropTail - 1) };
	const rows = [...headerRows, formatReasonixMetricsLine(content[footerIndex] ?? "", rowWidth), ""];
	// Collapsed rows fold the body away; the hit-test map keeps the body rows in
	// place, and the call/result regions only toggle the same flag, so the first
	// visible rows stay clickable.
	return { lines: rows, dropLead: dropLead + headerDrop, dropTail: Math.max(0, dropTail - 1) };
}

function normalizeBoxedLines(lines: string[]): NormalizedToolRender | undefined {
	const boxStart = lines.findIndex((line) => stripAnsi(line).startsWith("┌"));
	if (boxStart < 0) return undefined;
	let boxEnd = lines.length - 1;
	while (boxEnd > boxStart && stripAnsi(lines[boxEnd] ?? "").trim() === "") boxEnd--;
	return {
		lines: lines.slice(boxStart, boxEnd + 1),
		dropLead: boxStart,
		dropTail: lines.length - (boxEnd + 1),
	};
}

// Cache divider per width to keep stable string references across frames.
// Reset by setToolSpacingTheme() whenever the session theme changes.
let cachedDivider = "";
let cachedDividerWidth = -1;

function legacyWrapperInChain(): boolean {
	return Boolean((globalThis as Record<string, unknown>)[LEGACY_CHAIN_FLAG]);
}

/**
 * Full spacing normalizer for every presentation style. Image lines appended
 * by the core component are split off first and re-appended untouched.
 * Reasonix removes outer dividers, keeps one spacer row, and folds collapsed
 * output into a header plus metrics connector. Droid keeps existing spacing.
 */
function normalizeToolRenderLines(lines: string[], width: number, expanded: boolean): NormalizedToolRender {
	const { content, tail } = splitImageTail(lines);
	const unsplit: NormalizedToolRender = { lines, dropLead: 0, dropTail: 0 };

	if (getPresentationDesign().compactLayout) {
		const render = normalizeReasonixRender(content, width, expanded);
		return { ...render, lines: appendImageTail(render.lines, tail) };
	}

	const boxedLines = normalizeBoxedLines(content);
	if (boxedLines) return { ...boxedLines, lines: appendImageTail(boxedLines.lines, tail) };

	// A pre-versioned legacy wrapper already added divider/trailing-blank
	// spacing; keep its non-boxed output instead of stacking a second divider.
	if (legacyWrapperInChain()) return unsplit;

	if (getThemeExtra(cachedTheme, "showDivider") === "false") return { lines: appendImageTail([...content, ""], tail), dropLead: 0, dropTail: 0 };
	if (cachedDividerWidth !== width) {
		cachedDivider = buildDividerLine(width);
		cachedDividerWidth = width;
	}
	return { lines: appendImageTail([cachedDivider, ...content, ""], tail), dropLead: 0, dropTail: 0 };
}

/**
 * Replay the wrapper's head/tail line drops onto the core component's
 * hit-test map so clicks resolve to the rows that are actually drawn.
 */
function reconcileToolMouseLayout(owner: any, width: number, dropLead: number, dropTail: number): void {
	const layout = owner?.mouseLayout;
	if (!layout || layout.width !== width || !Array.isArray(layout.children)) return;
	if (dropLead <= 0 && dropTail <= 0) return;

	const heights = layout.children.map((child: any) => Math.max(0, Math.floor(child?.height ?? 0)));
	let lead = dropLead;
	for (let index = 0; index < heights.length && lead > 0; index++) {
		const taken = Math.min(heights[index]!, lead);
		heights[index] = heights[index]! - taken;
		lead -= taken;
	}
	let tail = dropTail;
	for (let index = heights.length - 1; index >= 0 && tail > 0; index--) {
		const taken = Math.min(heights[index]!, tail);
		heights[index] = heights[index]! - taken;
		tail -= taken;
	}
	layout.children = layout.children.map((child: any, index: number) => ({ component: child.component, height: heights[index]! }));
}

/**
 * Normalizes ToolExecution spacing without stacking reload patches.
 *
 * The render wrapper is installed at most once per host prototype and stays
 * behavior-free: all normalization flows through the RUNTIME_STATE_KEY
 * delegate, which is refreshed on every install. Wrappers left behind by
 * earlier module versions also read this delegate, so they pick up current
 * behavior (usesReasonix() is pinned true so old wrappers route every style
 * through the delegate instead of their stale inline droid/boxed paths that
 * would drop terminal image lines).
 */
export function installCompactToolSpacing(ToolExecutionComponentClass: any = ToolExecutionComponent): void {
	const proto = ToolExecutionComponentClass?.prototype as any;
	if (!proto || typeof proto.render !== "function") return;

	const globalState = globalThis as Record<string, unknown>;
	const existingVersion = proto.render[PATCH_VERSION_KEY];
	const existingDelegateAware = typeof existingVersion === "number" && existingVersion >= DELEGATE_AWARE_PATCH_VERSION;
	// Decide once per process whether a delegate-less wrapper (legacy unstamped
	// or version 2-9) already added its own spacing to the render chain.
	if (!(LEGACY_CHAIN_FLAG in globalState)) {
		globalState[LEGACY_CHAIN_FLAG] = Boolean(globalState[PATCH_FLAG]) && !existingDelegateAware;
	}
	globalState[PATCH_FLAG] = true;

	proto[RUNTIME_STATE_KEY] = {
		usesReasonix: () => true,
		normalizeReasonix: normalizeToolRenderLines,
		showDivider: () => getThemeExtra(cachedTheme, "showDivider") !== "false",
		buildDivider: buildDividerLine,
	} satisfies ToolSpacingRuntimeState;

	// A delegate-aware wrapper (version >= 10, this or an earlier module version)
	// already routes through RUNTIME_STATE_KEY; never stack a second wrapper on it.
	if (existingDelegateAware) return;

	const baseRender = proto.render;
	const patchedToolRender = function patchedToolRender(this: any, width: number): string[] {
		const rendered = baseRender.call(this, width);
		if (rendered.length === 0 || width <= 0) return rendered;
		const runtime = proto[RUNTIME_STATE_KEY] as ToolSpacingRuntimeState;
		const normalized = runtime.normalizeReasonix(rendered, width, Boolean(this.expanded));
		reconcileToolMouseLayout(this, width, normalized.dropLead, normalized.dropTail);
		return normalized.lines;
	};
	(patchedToolRender as any)[PATCH_VERSION_KEY] = PATCH_VERSION;
	proto.render = patchedToolRender;
}
