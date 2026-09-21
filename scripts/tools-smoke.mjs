#!/usr/bin/env node
// Smoke test: tool badge renderers (registerTool overrides), presentation
// styles, split-diff rendering, and config presentationStyle normalization.
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failures = 0;
function check(name, condition, detail = "") {
	if (condition) {
		console.log(`ok - ${name}`);
	} else {
		failures += 1;
		console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
	}
}

function stripAnsi(text) {
	return String(text).replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

// Isolate HOME
const tempHome = mkdtempSync(join(tmpdir(), "pi-ui-tools-smoke-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

// --- config: presentationStyle key ---
const { loadConfig, configPath } = await import("../src/config.ts");
const cfg = loadConfig();
check("config default presentationStyle is droid", cfg.presentationStyle === "droid", String(cfg.presentationStyle));
writeFileSync(configPath(), JSON.stringify({ presentationStyle: "reasonix" }));
await new Promise((r) => setTimeout(r, 1100));
check("config accepts reasonix", loadConfig().presentationStyle === "reasonix");
writeFileSync(configPath(), JSON.stringify({ presentationStyle: "bogus" }));
await new Promise((r) => setTimeout(r, 1100));
check("config rejects unknown presentationStyle", loadConfig().presentationStyle === "droid");
const rawCfg = JSON.parse(readFileSync(configPath(), "utf-8"));
check("config preserves unknown presentationStyle on disk", rawCfg.presentationStyle === "bogus");

// --- presentation state ---
const { setPresentationStyle, getPresentationStyle, getPresentationDesign } = await import("../src/tools/presentation/state.ts");
const { getReasonixCollapsedRowWidth } = await import("../src/tools/presentation/reasonix-layout.ts");
setPresentationStyle("reasonix");
check("presentation state round-trips reasonix", getPresentationStyle() === "reasonix");
check("reasonix design strips background", getPresentationDesign().stripsBackground === true);
check("reasonix collapsed row width ratio", getReasonixCollapsedRowWidth(100) === 80 && getReasonixCollapsedRowWidth(30) === 30);
setPresentationStyle("droid");
check("presentation state round-trips droid", getPresentationStyle() === "droid");
check("droid design keeps background", getPresentationDesign().stripsBackground === false);

// --- theme fixture ---
const theme = {
	borderColor: (t) => t,
	selectList: {},
	fg: (color, text) => (color === "dim" ? `\x1b[2m${text}\x1b[22m` : color === "accent" ? `\x1b[32m${text}\x1b[39m` : text),
	bg: (color, text) => text,
	getFgAnsi: (color) => {
		const map = { toolDiffAdded: "\x1b[38;2;88;173;88m", toolDiffRemoved: "\x1b[38;2;200;80;80m", accent: "\x1b[38;2;137;180;250m", muted: "\x1b[38;2;140;140;140m", dim: "\x1b[2m" };
		return map[color] ?? "\x1b[37m";
	},
	getBgAnsi: () => "\x1b[48;2;30;30;40m",
	getColorMode: () => "truecolor",
	bold: (t) => t,
	inverse: (t) => t,
};

// --- tool tag registration via a fake pi ---
const { registerToolCallTags } = await import("../src/tools/register-tool-call-tags.ts");
const tools = new Map();
const fakePi = {
	registerTool(definition) {
		tools.set(definition.name, definition);
	},
};
await registerToolCallTags(fakePi);
for (const expected of ["bash", "read", "write", "edit", "ls", "find", "grep"]) {
	check(`tool override registered: ${expected}`, tools.has(expected));
}

function renderComponent(component, width = 90) {
	return component.render(width).map(stripAnsi);
}

// bash renderCall: boxed header with the command
const bashDef = tools.get("bash");
const bashCall = renderComponent(bashDef.renderCall({ command: "npm test" }, theme, { isPartial: false }));
check("bash call box shows tool name", bashCall.some((l) => l.includes("Bash")));
check("bash call box shows command", bashCall.some((l) => l.includes("npm test")));

// bash renderResult: a finished result collapses to the badge (footer stashed on the
// render state, drawn by the compact call box).
const setCollapseMode = async (mode) => {
	writeFileSync(configPath(), JSON.stringify({ collapseToolOutput: mode }));
	await new Promise((resolve) => setTimeout(resolve, 1100));
};
const bashOutput = {
	content: [{ type: "text", text: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n") }],
	isError: false,
};
const bashState = {};
const bashResult = bashDef.renderResult(bashOutput, { expanded: false, isPartial: false }, theme, { isPartial: false, hasResult: true, state: bashState });
check("bash finished result collapses to the badge", renderComponent(bashResult, 90).length === 0);
const bashCompactCall = renderComponent(bashDef.renderCall({ command: "npm test" }, theme, { expanded: false, hasResult: true, isPartial: false, state: bashState }), 90);
check("bash collapsed badge keeps the command", bashCompactCall.some((l) => l.includes("npm test")));
check("bash collapsed badge shows the metrics footer", bashCompactCall.some((l) => l.includes("◷")));
check("bash collapsed badge is three rows", bashCompactCall.length === 3, String(bashCompactCall.length));
check("bash collapsed badge hides output", !bashCompactCall.some((l) => l.includes("line 30")));

// onComplete keeps the live tail while the call is still running
const bashPartial = renderComponent(bashDef.renderResult(bashOutput, { expanded: false, isPartial: true }, theme, { isPartial: true, hasResult: true, state: {} }), 90);
check("bash running keeps the live tail under onComplete", bashPartial.some((l) => l.includes("line 30")));

// always collapses as soon as output exists
await setCollapseMode("always");
const bashAlwaysPartial = renderComponent(bashDef.renderResult(bashOutput, { expanded: false, isPartial: true }, theme, { isPartial: true, hasResult: true, state: {} }), 90);
check("bash running collapses under always", bashAlwaysPartial.length === 0);

// never keeps the legacy tail preview
await setCollapseMode("never");
const bashLegacy = renderComponent(bashDef.renderResult(bashOutput, { expanded: false, isPartial: false }, theme, { isPartial: false, hasResult: true, state: {} }), 90);
check("bash finished keeps the legacy tail under never", bashLegacy.some((l) => l.includes("line 30")));

// errors stay open in every mode
await setCollapseMode("onComplete");
const bashError = renderComponent(
	bashDef.renderResult({ content: [{ type: "text", text: "boom" }], isError: true }, { expanded: false, isPartial: false }, theme, {
		isPartial: false,
		hasResult: true,
		isError: true,
		state: {},
	}),
	90,
);
check("bash errors are never collapsed", bashError.some((l) => l.includes("boom")));

// expanded rows show the full output again
const bashExpanded = renderComponent(bashDef.renderResult(bashOutput, { expanded: true }, theme, { isPartial: false, hasResult: true, state: {} }), 90);
check("bash expanded shows the full output", bashExpanded.some((l) => l.includes("line 1 ")) && bashExpanded.some((l) => l.includes("line 30")));
check("bash shows metrics footer", renderComponent(bashOutput && bashDef.renderResult(bashOutput, { expanded: true }, theme, { isPartial: false, hasResult: true, state: {} }), 90).some((l) => l.includes("words")));

// read renderCall: path label
const readDef = tools.get("read");
const readCall = renderComponent(readDef.renderCall({ path: "/tmp/project/src/index.ts" }, theme, {}));
check("read call shows Path label", readCall.some((l) => l.includes("Read") && l.includes("index.ts")));

// grep renderCall: Search badge with pattern
const grepDef = tools.get("grep");
const grepCall = renderComponent(grepDef.renderCall({ pattern: "loadConfig", path: "src" }, theme, {}));
check("grep call shows Search badge", grepCall.some((l) => l.includes("Search")));
check("grep call shows pattern", grepCall.some((l) => l.includes("loadConfig")));

// ls renderCall: List badge
const lsCall = renderComponent(tools.get("ls").renderCall({ path: "src" }, theme, {}));
check("ls call shows List badge", lsCall.some((l) => l.includes("List")));

// find renderCall: Find badge
const findCall = renderComponent(tools.get("find").renderCall({ pattern: "*.ts", path: "src" }, theme, {}));
check("find call shows Find badge", findCall.some((l) => l.includes("Find")));

// write renderCall: Write badge with path
const writeCall = renderComponent(tools.get("write").renderCall({ path: "/tmp/out.txt" }, theme, {}));
check("write call shows Write badge", writeCall.some((l) => l.includes("Write") && l.includes("out.txt")));

// default badge: fallback for unstyled tools via the patched ToolExecutionComponent is a
// component-level patch (needs pi runtime), so here we only verify common's boxed renderers.
const { renderBoxedToolCall, renderBoxedToolResult, formatToolName } = await import("../src/tools/common.ts");
const defaultCall = renderComponent(renderBoxedToolCall(theme, "WebSearch", ["query: pi coding agent"], { isPending: true }), 90);
check("boxed default call renders custom tool name", defaultCall.some((l) => l.includes("WebSearch")));
check("boxed default call shows params", defaultCall.some((l) => l.includes("pi coding agent")));
const { annotateToolResultMetrics, getElapsedMs } = await import("../src/tools/elapsed.ts");
const annotated = { content: [{ type: "text", text: "ok" }] };
annotateToolResultMetrics(annotated, 1234);
check("elapsed annotation stores metrics", getElapsedMs(annotated) === 1234);

// --- split diff ---
const { buildSplitRows, SplitDiffComponent, countDiffStats, renderDiffMeter } = await import("../src/tools/split-diff.ts");
const sampleDiff = [
	"--- a/src/sample.ts",
	"+++ b/src/sample.ts",
	"@@ -1,4 +1,4 @@",
	" const a = 1;",
	"-const b = 2;",
	"+const b = 3;",
	" export { a, b };",
].join("\n");
const rows = buildSplitRows(sampleDiff);
check("split rows built", Array.isArray(rows) && rows.length > 0);
const stats = countDiffStats(sampleDiff);
check("diff stats count one add and one remove", stats.additions === 1 && stats.removals === 1, JSON.stringify(stats));
const meter = stripAnsi(renderDiffMeter(theme, stats.additions, stats.removals));
check("diff meter renders a half/half bar for 1 add / 1 remove", /^\[━+\]$/.test(meter) && meter.length === 22, meter);
const diffComponent = new SplitDiffComponent(theme, rows, 200);
const diffLines = diffComponent.render(80).map(stripAnsi);
check("split diff renders both columns", diffLines.some((l) => l.includes("│") && (l.includes("b = 2") || l.includes("b = 3"))));
check("split diff shows change markers", diffLines.some((l) => l.includes("▌")));

// --- edit collapse ---
const editDef = tools.get("edit");
const editState = {};
const editResult = editDef.renderResult(
	{ content: [{ type: "text", text: "edited" }], details: { diff: sampleDiff } },
	{ expanded: false, isPartial: false },
	theme,
	{ isPartial: false, hasResult: true, isError: false, state: editState, args: { path: "/tmp/sample.ts" }, cwd: process.cwd() },
);
check("edit finished result collapses to the badge", renderComponent(editResult, 90).length === 0);
const editCall = renderComponent(
	editDef.renderCall({ path: "/tmp/sample.ts" }, theme, { expanded: false, hasResult: true, isPartial: false, state: editState, cwd: process.cwd() }),
	90,
);
check("edit collapsed badge shows diff stats", editCall.some((l) => l.includes("+1") && l.includes("−1")), editCall.join(" | "));
check("edit collapsed badge hides the diff body", !editCall.some((l) => l.includes("b = 3")));
const editExpanded = renderComponent(
	editDef.renderResult(
		{ content: [{ type: "text", text: "edited" }], details: { diff: sampleDiff } },
		{ expanded: true, isPartial: false },
		theme,
		{ isPartial: false, hasResult: true, isError: false, state: {}, args: { path: "/tmp/sample.ts" }, cwd: process.cwd() },
	),
	90,
);
check("edit expanded shows the split diff", editExpanded.some((l) => l.includes("b = 3")));

// --- default badge (unknown tools) collapse ---
// The fallback lives in a prototype patch, so drive it with a real
// ToolExecutionComponent built without a registered renderer definition.
const { installDefaultBadge, setDefaultBadgeTheme } = await import("../src/tools/default-badge.ts");
const { installCompactToolSpacing, setToolSpacingTheme } = await import("../src/tools/compact-tool-spacing.ts");
const { initTheme, ToolExecutionComponent } = await import("@earendil-works/pi-coding-agent");
initTheme("dark");
setDefaultBadgeTheme(theme);
setToolSpacingTheme(theme);
installDefaultBadge();
installCompactToolSpacing();
const defaultTool = new ToolExecutionComponent("WebSearch", "call-1", { query: "pi coding agent" }, { showImages: false }, undefined, { requestRender() {} }, process.cwd());
defaultTool.updateResult({ content: [{ type: "text", text: "found things" }], isError: false }, false);
const defaultLines = renderComponent(defaultTool, 90);
check("default badge collapses unknown tools to a badge", defaultLines.length === 3, String(defaultLines.length));
check("default badge keeps the tool name", defaultLines.some((l) => l.includes("Web Search")));
check("default badge hides the output when collapsed", !defaultLines.some((l) => l.includes("found things")));
check("default badge shows the metrics footer", defaultLines.some((l) => l.includes("◷")));

// The spacing wrapper drops the leading spacer row; clicks must still map to
// the rows that are drawn (regression guard for the hit-test reconciliation).
const clickRow = (owner, y, width, height) =>
	owner.handleMouse({ type: "click", button: "left", x: 1, y, screenX: 1, screenY: y, width, height, shift: false, alt: false, ctrl: false });
const collapsedHeight = defaultLines.length;
check("default badge click on the top row expands", Boolean(clickRow(defaultTool, 0, 90, collapsedHeight)) && defaultTool.expanded === true);
check("default badge click on the bottom row collapses", Boolean(clickRow(defaultTool, collapsedHeight - 1, 90, collapsedHeight)) && defaultTool.expanded === false);

rmSync(tempHome, { recursive: true, force: true });

if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll tools smoke checks passed");
