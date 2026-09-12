#!/usr/bin/env node
// Smoke test: user-zone style resolver, BoxEditor rendering per style/frame,
// and the fixed-zone cluster helper. Runs the real TS sources (Node type stripping).
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
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

// Isolate HOME so theme-extras/config never touch the real ~/.pi
const tempHome = mkdtempSync(join(tmpdir(), "pi-ui-zone-smoke-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;
// Most assertions below describe the classic look: prompt glyph + footer line ON.
// (Both default off; the end of this file covers the default-off rendering.)
mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
writeFileSync(join(tempHome, ".pi", "agent", "pi-ui.json"), JSON.stringify({ userZoneStyle: "gemini", editorPrompt: true, editorFooter: true, showProvider: true }));

const { USER_ZONE_STYLE_NAMES, resolveUserZoneStyle } = await import("../src/editor/user-zone.ts");
const { setFullTheme } = await import("../src/theme/theme-extras.ts");
const { BoxEditor } = await import("../src/editor/box-editor.ts");
const { renderFixedUserZoneCluster } = await import("../src/editor/cluster.ts");
const { CURSOR_MARKER } = await import("@earendil-works/pi-tui");

// --- style resolver ---
check("style names", USER_ZONE_STYLE_NAMES.join(",") === "droid,gemini,cli-dock,nvim");
check("droid host border", resolveUserZoneStyle("droid").editor.showHostBorder === true);
check("gemini layout", resolveUserZoneStyle("gemini").editor.layout === "gemini");
check("gemini prompt glyph", resolveUserZoneStyle("gemini").editor.prompt === "❯");
check("gemini auto frame", resolveUserZoneStyle("gemini").editor.inputFrame === "auto");
check("cli-dock layout", resolveUserZoneStyle("cli-dock").editor.layout === "cli-dock");
check("cli-dock prompt glyph", resolveUserZoneStyle("cli-dock").editor.prompt === "›");
check("cli-dock outline frame", resolveUserZoneStyle("cli-dock").editor.inputFrame === "outline");
check("missing style → gemini default", resolveUserZoneStyle(undefined).name === "gemini");
check("unknown style → droid fallback", resolveUserZoneStyle("unknown").name === "droid");
check("inherited key → droid fallback", resolveUserZoneStyle("toString").name === "droid");

// --- theme fixture (no disk scan) ---
const themePath = join(tempHome, "extras-theme.json");
writeFileSync(themePath, JSON.stringify({ extras: { bashPromptColor: "thinkingText", userPrefixColor: "accent" } }));
setFullTheme({ sourcePath: themePath }, true);

const INPUT_BACKGROUND_ANSI = "\x1b[48;2;100;107;56m";
const INPUT_BACKGROUND_AS_FG_ANSI = "\x1b[38;2;100;107;56m";
const WRONG_INPUT_BACKGROUND_FG_ANSI = "\x1b[38;2;200;10;10m";

function makeTheme() {
	return {
		borderColor: (text) => text,
		selectList: {},
		fg: (color, text) => {
			if (color === "selectedBg") return `${WRONG_INPUT_BACKGROUND_FG_ANSI}${text}\x1b[39m`;
			if (color === "dim") return `\x1b[2m${text}\x1b[22m`;
			if (color === "borderMuted") return `\x1b[90m${text}\x1b[39m`;
			if (color === "muted") return `\x1b[37m${text}\x1b[39m`;
			if (color === "border") return `\x1b[34m${text}\x1b[39m`;
			if (color === "accent") return `\x1b[32m${text}\x1b[39m`;
			if (color === "thinkingText") return `\x1b[36m${text}\x1b[39m`;
			return text;
		},
		bg: (color, text) => (color === "selectedBg" ? `${INPUT_BACKGROUND_ANSI}${text}\x1b[49m` : text),
		getBgAnsi: (color) => {
			if (color === "selectedBg") return INPUT_BACKGROUND_ANSI;
			throw new Error(`unknown background ${color}`);
		},
		bold: (text) => `\x1b[1m${text}\x1b[22m`,
		inverse: (text) => text,
	};
}

const tui = { terminal: { rows: 32, columns: 100 }, requestRender() {} };
const keybindings = { matches: () => false };
const usage = () => ({ tokens: 12000, percent: 25, contextWindow: 48000 });
const model = () => ({ provider: "openai", id: "gpt-test", name: "Deepseek V4 Flash", reasoning: true, thinkingLevel: "high" });
const branch = () => ({ branch: "main", insertions: 2, deletions: 1 });
const speed = () => 42;
const footer = () => "ready";
const cliDockFooter = () => "MCP ✓";

function renderStyle(styleName, { raw = false, width = 88, footerProvider = footer, inputBoxStyle, text = "hello", noColor = false } = {}) {
	const previousNoColor = process.env.NO_COLOR;
	if (noColor) process.env.NO_COLOR = "1";
	else delete process.env.NO_COLOR;
	try {
		const editor = new BoxEditor(
			tui,
			makeTheme(),
			keybindings,
			makeTheme(),
			join(tempHome, "project"),
			usage,
			model,
			branch,
			speed,
			footerProvider,
			() => "footer",
			resolveUserZoneStyle(styleName),
			inputBoxStyle,
		);
		editor.setText(text);
		const rendered = editor.render(width);
		return raw ? rendered : rendered.map(stripAnsi);
	} finally {
		if (previousNoColor === undefined) delete process.env.NO_COLOR;
		else process.env.NO_COLOR = previousNoColor;
	}
}

const droid = renderStyle("droid");
const rawDroid = renderStyle("droid", { raw: true });
const gemini = renderStyle("gemini");
const rawGemini = renderStyle("gemini", { raw: true });
const cliDock = renderStyle("cli-dock", { footerProvider: cliDockFooter });
const rawCliDock = renderStyle("cli-dock", { raw: true, footerProvider: cliDockFooter });
const cliDockLineOverride = renderStyle("cli-dock", { footerProvider: cliDockFooter, inputBoxStyle: "line" });
const emptyCliDock = renderStyle("cli-dock", { footerProvider: cliDockFooter, text: "" });
const narrowGemini = renderStyle("gemini", { width: 34, footerProvider: () => "very long status message for narrow terminal" });
const noColorGemini = renderStyle("gemini", { noColor: true });
const rawNoColorGemini = renderStyle("gemini", { raw: true, noColor: true });
const geminiLine = renderStyle("gemini", { inputBoxStyle: "line" });
const rawGeminiLine = renderStyle("gemini", { raw: true, inputBoxStyle: "line" });
const geminiSolid = renderStyle("gemini", { inputBoxStyle: "solid" });
const rawGeminiSolid = renderStyle("gemini", { raw: true, inputBoxStyle: "solid" });
const droidLine = renderStyle("droid", { inputBoxStyle: "line" });
const droidHalfblock = renderStyle("droid", { inputBoxStyle: "halfblock" });

// droid
check("droid 6-row shell", droid.length === 6, String(droid.length));
check("droid host border", droid.some((line) => line.includes("== [")));
check("droid stat label", droid.some((line) => line.includes("[stat]")));

// gemini
check("gemini 6-row shell", gemini.length === 6, String(gemini.length));
check("cli-dock 4-row shell", cliDock.length === 4, String(cliDock.length));
check("cli-dock outline top", cliDock[0]?.startsWith("┌") && cliDock[0]?.endsWith("┐"));
check("cli-dock full width", cliDock[0]?.length === 88 && cliDock[1]?.length === 88 && cliDock[2]?.length === 88);
check("cli-dock outline muted color", rawCliDock[0]?.includes("\x1b[90m") && !rawCliDock[0]?.includes("\x1b[32m"));
check("cli-dock input row content", cliDock[1]?.startsWith("│") && cliDock[1]?.endsWith("│") && cliDock[1]?.includes("›") && cliDock[1]?.includes("hello"));
check("cli-dock bottom border", cliDock[2]?.startsWith("└") && cliDock[2]?.endsWith("┘"));
check("cli-dock status row model", cliDock[3]?.includes("Deepseek V4 Flash · high"));
check("cli-dock status row ctx", cliDock[3]?.includes("Ctx: 12k/48k"));
check("cli-dock status row branch+project", cliDock[3]?.includes("🌿 main") && cliDock[3]?.includes("📁"));
check("cli-dock status row footer right", cliDock[3]?.includes("MCP ✓") && !cliDock[3]?.includes("⏱"));
check("cli-dock keeps outline with line override", cliDockLineOverride[0]?.includes("┌") && cliDockLineOverride[1]?.includes("│") && cliDockLineOverride[2]?.includes("└"));
check("cli-dock placeholder", emptyCliDock[1]?.includes("Type a prompt or / for commands"));
check("gemini divider visible", gemini[0]?.replace(/─/g, "").trim() === "");
check("gemini divider bold border color", rawGemini[0]?.includes("\x1b[34m") && rawGemini[0]?.includes("\x1b[1m"));
const rawGeminiPromptLine = rawGemini.find((line) => stripAnsi(line).includes("❯"));
check("gemini prompt accent", rawGeminiPromptLine?.includes("\x1b[32m❯") && !rawGeminiPromptLine?.includes("\x1b[36m❯"));
const rawDroidPromptLine = rawDroid.find((line) => stripAnsi(line).includes("❯"));
check("droid prompt accent", rawDroidPromptLine?.includes("\x1b[32m❯") && !rawDroidPromptLine?.includes("\x1b[36m❯"));
check("gemini branch on status row", gemini[1]?.includes("main"));
check("gemini compact model", gemini[1]?.includes("openai gpt-test · high"));
check("gemini model before tokens", (gemini[1]?.indexOf("openai gpt-test · high") ?? -1) < (gemini[1]?.indexOf("12k") ?? -1));
check("gemini token stats", gemini[1]?.includes("12k") && gemini[1]?.includes("25.0%/48k"));
check("gemini status pipe", gemini[1]?.includes("│"));
check("gemini top halfline", gemini[2]?.includes("▄") && gemini[2]?.replace(/▄/g, "").trim() === "");
check("gemini bottom halfline", gemini[4]?.includes("▀") && gemini[4]?.replace(/▀/g, "").trim() === "");
check("gemini halfline bg-as-fg", rawGemini[2]?.includes(INPUT_BACKGROUND_AS_FG_ANSI));
check("gemini input row bg", rawGemini[3]?.includes(INPUT_BACKGROUND_ANSI));
check("gemini NO_COLOR line fallback top", noColorGemini[2]?.includes("─") && noColorGemini[2]?.replace(/─/g, "").trim() === "");
check("gemini NO_COLOR line fallback bottom", noColorGemini[4]?.includes("─") && noColorGemini[4]?.replace(/─/g, "").trim() === "");
check("gemini NO_COLOR keeps bg color as fg", rawNoColorGemini[2]?.includes(INPUT_BACKGROUND_AS_FG_ANSI));
check("gemini explicit line top", geminiLine[2]?.includes("─") && geminiLine[2]?.replace(/─/g, "").trim() === "");
check("gemini explicit line no bg", !rawGeminiLine[3]?.includes(INPUT_BACKGROUND_ANSI));
check("gemini solid drops padding row", geminiSolid.length === gemini.length - 1, String(geminiSolid.length));
check("gemini solid input placement", geminiSolid[2]?.includes("❯") && geminiSolid[2]?.includes("hello"));
check("gemini solid bottom clean", !geminiSolid[3]?.includes("▄") && !geminiSolid[3]?.includes("▀") && geminiSolid[3]?.trim() === "");
check("gemini solid bottom bg", rawGeminiSolid[3]?.includes(INPUT_BACKGROUND_ANSI));
check("droid line == droid native", JSON.stringify(droidLine) === JSON.stringify(droid));
check("droid halfblock adds frame rows", droidHalfblock.length === 8, String(droidHalfblock.length));
check("droid halfblock top", droidHalfblock[4]?.includes("▄") && droidHalfblock[4]?.replace(/▄/g, "").trim() === "");
check("droid halfblock bottom", droidHalfblock[6]?.includes("▀") && droidHalfblock[6]?.replace(/▀/g, "").trim() === "");
check("gemini input prompt+text", gemini[3]?.includes("❯") && gemini[3]?.includes("hello"));
check("gemini footer cwd+status", gemini[5]?.includes("project") && gemini[5]?.includes("ready"));
check("gemini footer status right", gemini[5]?.trimEnd().endsWith("ready"));
check("gemini footer dim", rawGemini[5]?.includes("\x1b[2m"));
check("gemini narrow keeps rows", narrowGemini.length === gemini.length);
check("gemini narrow truncates right", narrowGemini[5]?.trimEnd().endsWith("…"));
check("gemini narrow no overflow", narrowGemini.every((line) => stripAnsi(line).length <= 34));
check("gemini hides host border", !gemini.some((line) => line.includes("== [")));

// --- fixed-zone cluster ---
const directGeminiCluster = renderFixedUserZoneCluster(
	[
		{
			target: { render: () => [] },
			render: (width) => [
				`${CURSOR_MARKER}${INPUT_BACKGROUND_ANSI}${"editor".padEnd(width)}\x1b[49m`,
				`${"workspace".padEnd(width - "ready".length)}ready`,
			],
		},
	],
	60,
	4,
	{ scrollHint: "^Alt T TOP", hintRightInset: 0, scrollHintPlacement: "lastLine" },
);
check("cluster hint moved out of input row", !stripAnsi(directGeminiCluster.lines[0] ?? "").includes("^Alt"));
check("cluster hint appended to footer", stripAnsi(directGeminiCluster.lines[1] ?? "").trimEnd().endsWith("ready  [^Alt T TOP]"));

rmSync(join(tempHome, ".pi", "agent", "pi-ui.json"), { force: true });
writeFileSync(join(tempHome, ".pi", "agent", "pi-ui.json"), JSON.stringify({ userZoneStyle: "gemini" }));
await new Promise((resolve) => setTimeout(resolve, 1100));
const defaultGemini = renderStyle("gemini");
check("gemini default: no prompt glyph", !defaultGemini.some((l) => l.includes("❯")), defaultGemini.join("\n"));
check("gemini default: no footer row", defaultGemini.length === 5, String(defaultGemini.length));
check("gemini default: input text still renders", defaultGemini[3]?.includes("hello"), defaultGemini.join("\n"));
check("gemini default: provider hidden", !defaultGemini.some((l) => l.includes("openai")) && defaultGemini.some((l) => l.includes("gpt-test")), defaultGemini.join("\n"));
const defaultDroid = renderStyle("droid");
check("droid default: provider badge hidden", !defaultDroid.some((l) => l.includes("[OPENAI]")) && defaultDroid.some((l) => l.includes("gpt-test")), defaultDroid.join("\n"));
const defaultNvim = renderStyle("nvim");
check("nvim default: no prompt glyph", !defaultNvim.some((l) => l.includes("❯")), defaultNvim.join("\n"));
const defaultCliDock = renderStyle("cli-dock", { footerProvider: cliDockFooter });
check("cli-dock default: no prompt glyph", !defaultCliDock.some((l) => l.includes("›")), defaultCliDock.join("\n"));
check("cli-dock default: keeps status row", defaultCliDock[3]?.includes("Deepseek V4 Flash"), defaultCliDock.join("\n"));

// --- mouse click-to-position (coordinate translation into the base editor) ---
const mouseTui = { terminal: { rows: 32, columns: 100 }, requestRender() {} };
const mouseEditor = new BoxEditor(
	mouseTui,
	makeTheme(),
	keybindings,
	makeTheme(),
	join(tempHome, "mouse-project"),
	usage,
	model,
	branch,
	speed,
	footer,
	() => "footer",
	resolveUserZoneStyle("gemini"),
	undefined,
);
mouseEditor.setText("hello world");
mouseEditor.render(88);
const click = (x, y) => mouseEditor.handleMouse({
	type: "click", button: "left", x, y, width: 88,
	screenX: x, screenY: y, shift: false, alt: false, ctrl: false,
});
// Click 2 columns into the text area ("he|llo world") → cursor col 2
click(mouseEditor.lastInputInset + 2, mouseEditor.lastInputStart);
const afterClick = mouseEditor.getCursor();
check("mouse click maps to cursor column", afterClick.line === 0 && afterClick.col === 2, JSON.stringify(afterClick));
// Click far right beyond text → cursor at end of "hello world" (11)
click(mouseEditor.lastInputInset + 50, mouseEditor.lastInputStart);
const afterFar = mouseEditor.getCursor();
check("mouse click past text clamps to end", afterFar.line === 0 && afterFar.col === 11, JSON.stringify(afterFar));
// Click a non-input row (status row) → cursor unchanged
click(10, mouseEditor.lastInputStart - 1);
check("mouse click outside input ignored", mouseEditor.getCursor().col === 11);

rmSync(tempHome, { recursive: true, force: true });

if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll user-zone smoke checks passed");
