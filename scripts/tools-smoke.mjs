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

// bash renderResult: collapsed shows a preview tail + metrics footer
const bashResult = bashDef.renderResult(
	{ content: [{ type: "text", text: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n") }], isError: false },
	{ expanded: false },
	theme,
	{ isPartial: false, hasResult: true },
);
const bashResultLines = renderComponent(bashResult, 90);
check("bash result collapsed keeps tail lines", bashResultLines.some((l) => l.includes("line 30")));
check("bash result collapsed hides early lines", !bashResultLines.some((l) => l.includes("line 1 ")));
check("bash result shows metrics footer", bashResultLines.some((l) => /\d/.test(l) && (l.includes("·") || l.includes("words"))));

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

rmSync(tempHome, { recursive: true, force: true });

if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll tools smoke checks passed");
