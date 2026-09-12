#!/usr/bin/env node
// Smoke test: gradient startup header, OSC 11 terminal background sync, and
// the welcome screen brand-column integration.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
	return String(text)
		.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
		.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

const tempHome = mkdtempSync(join(tmpdir(), "pi-ui-startup-smoke-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

const { initTheme } = await import("@earendil-works/pi-coding-agent");
initTheme("dark");
// Rich fake theme modeled on the real Theme API surface (accent = catppuccin blue).
const theme = {
	bold: (t) => `\x1b[1m${t}\x1b[22m`,
	fg: (color, text) => (color === "accent" ? `\x1b[38;2;137;180;250m${text}\x1b[39m` : color === "dim" ? `\x1b[2m${text}\x1b[22m` : color === "success" ? `\x1b[38;2;166;227;161m${text}\x1b[39m` : color === "muted" ? `\x1b[38;2;166;173;200m${text}\x1b[39m` : text),
	getFgAnsi: (color) => (color === "accent" ? "\x1b[38;2;137;180;250m" : "\x1b[39m"),
	getColorMode: () => "truecolor",
};

const { logoLines, logoWidth, renderStartupHeader, startupBodyWidth, suppressStartupModelScopeLog } = await import("../src/startup.ts");

// --- gradient logo ---
const lines = logoLines(theme);
check("logo has 9 rows", lines.length === 9, String(lines.length));
check("logo gradient uses truecolor escapes", lines.join("").includes("\x1b[38;2;"), "no RGB escapes found");
check("logo rows differ in color phase", new Set(lines.map((l) => l.slice(0, 40))).size > 1);
check("logo width is stable", logoWidth() === 18, String(logoWidth()));
check("logo glyphs preserved under strip", stripAnsi(lines.join("")).includes("███████████╗"));
// repeated call returns the cached instance (same array reference)
check("logo gradient is cached per theme", logoLines(theme) === lines);

// --- compact header ---
const header = renderStartupHeader(theme, 100);
const headerPlain = header.map(stripAnsi);
check("header is indented by 3 spaces", header.every((l) => l === "" || l.startsWith("   ")));
check("header contains Pi title", headerPlain.join("\n").includes("Pi v"));
check("header contains key hints", headerPlain.join("\n").includes("/") && headerPlain.join("\n").includes("commands"));
check("header contains ready status", headerPlain.join("\n").includes("ready") && headerPlain.join("\n").includes("●"));
check("header lines fit width", headerPlain.every((l) => stripAnsi(l).length <= 100 + 3));
// narrow terminal: details drop below the logo
const narrowHeader = renderStartupHeader(theme, 24).map(stripAnsi);
check("narrow header still shows title and status", narrowHeader.some((l) => l.includes("Pi v")) && narrowHeader.some((l) => l.includes("ready")));
// very narrow: only title + status
const tinyHeader = renderStartupHeader(theme, 10).map(stripAnsi);
check("tiny header shows title + status only", tinyHeader.length === 2 && tinyHeader[0].includes("Pi v"));

// --- model scope log suppressor ---
// The suppressor REPLACES console.log. Capture what it lets through by
// temporarily rerouting real stdout, then counting printed lines.
suppressStartupModelScopeLog();
const printed = [];
const realStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => {
	printed.push(String(chunk));
	return true;
};
console.log("Model scope: anthropic (Ctrl+P to cycle)");
console.log("normal message");
process.stdout.write = realStdoutWrite;
check("model scope line suppressed", printed.length === 1 && printed[0].includes("normal message"), JSON.stringify(printed));
// second call is a no-op (idempotent)
suppressStartupModelScopeLog();

// --- OSC 11 ---
const { terminalBackgroundOsc11, resetTerminalBackgroundOsc111, applyTerminalPageBackgroundOsc11, shouldApplyTerminalBackgroundOsc11 } = await import("../src/theme/terminal-bg.ts");
check("osc11 sequence format", terminalBackgroundOsc11("#11111b") === "\x1b]11;#11111b\x07");
check("osc11 normalizes 3-digit hex", terminalBackgroundOsc11("#abc") === "\x1b]11;#aabbcc\x07");
check("osc111 reset format", resetTerminalBackgroundOsc111() === "\x1b]111\x07");
check("osc11 applies on non-windows", shouldApplyTerminalBackgroundOsc11({ platform: "darwin" }) === true);
check("osc11 skipped on windows", shouldApplyTerminalBackgroundOsc11({ platform: "win32" }) === false);
check("osc11 forced overrides windows", shouldApplyTerminalBackgroundOsc11({ platform: "win32", force: true }) === true);
check("osc11 skipped for WSL", shouldApplyTerminalBackgroundOsc11({ platform: "linux", env: { WSL_DISTRO_NAME: "Ubuntu" } }) === false);

// apply with our real theme file (has export.pageBg)
const { setFullTheme } = await import("../src/theme/theme-extras.ts");
const themePath = join(tempHome, "pagebg-theme.json");
writeFileSync(themePath, JSON.stringify({ name: "t", vars: {}, colors: {}, export: { pageBg: "#1e1e2e" } }));
setFullTheme({ sourcePath: themePath, fg: (c, t) => t, bold: (t) => t }, true);
const writes = [];
const fakeTerminal = { write: (data) => writes.push(data) };
const restore = applyTerminalPageBackgroundOsc11({ sourcePath: themePath }, fakeTerminal);
check("osc11 writes theme page background", writes.length === 1 && writes[0] === "\x1b]11;#1e1e2e\x07", JSON.stringify(writes));
restore?.();
check("osc111 reset written on restore", writes.length === 2 && writes[1] === "\x1b]111\x07", JSON.stringify(writes));
// restore is idempotent
restore?.();
check("osc11 restore is idempotent", writes.length === 2);
// theme without a hex page background → the export cache must not leak the
// previous theme's pageBg; ensureThemeExportLoaded re-reads per sourcePath.
const otherThemePath = join(tempHome, "nobg-theme.json");
writeFileSync(otherThemePath, JSON.stringify({ name: "nobg", vars: {}, colors: {}, export: {} }));
setFullTheme({ sourcePath: otherThemePath, fg: (c, t) => t, bold: (t) => t }, true);
const noBg = applyTerminalPageBackgroundOsc11({ sourcePath: otherThemePath }, fakeTerminal);
check("osc11 no-ops without a page background", noBg === undefined && writes.length === 2);

// --- compact resource summary (installStartupUiPatch) ---
const { installStartupUiPatch } = await import("../src/startup.ts");

function makeFakeMode() {
	const calls = [];
	const chatChildren = [];
	class FakeMode {
		options = { verbose: false };
		session = {
			resourceLoader: {
				getSkills: () => ({ skills: [{ name: "handbook" }, { name: "git-join" }] }),
				getThemes: () => ({ themes: [{ name: "catppuccin-dark", sourcePath: "/themes/x.json" }] }),
				getExtensions: () => ({ extensions: [{ path: "/ext/pi-ui/src/index.ts" }] }),
				getAgentsFiles: () => ({ agentsFiles: [{ path: "/tmp/AGENTS.md", content: "one two three four five" }] }),
				getSystemPrompt: () => "be brief and helpful",
				getAppendSystemPrompt: () => [],
			},
			scopedModels: [{ model: { provider: "openai", id: "gpt-test" } }],
			promptTemplates: [{ name: "review" }],
			getAllTools: () => [
				{ name: "read", sourceInfo: { source: "builtin" } },
				{ name: "web-search", sourceInfo: { source: "npm:@scope/tools" } },
			],
			getActiveToolNames: () => ["read", "web-search"],
		};
		sessionManager = { getCwd: () => tempHome };
		settingsManager = { getQuietStartup: () => false };
		chatContainer = { addChild: (c) => chatChildren.push(c) };
		getStartupExpansionState() { return false; }
		formatContextPath(p) { return p; }
		getCompactExtensionLabels(extensions) { return extensions.map((e) => e.path.split("/").pop()); }
		getCompactPathLabel(p) { return p; }
		showLoadedResources(options) { calls.push({ options, quietDuringCall: this.settingsManager.getQuietStartup() }); return []; }
	}
	return { FakeMode, calls, chatChildren };
}

const { FakeMode, calls, chatChildren } = makeFakeMode();
installStartupUiPatch(FakeMode);
const fakeMode = new FakeMode();
const rendered = fakeMode.showLoadedResources({ force: true });
check("resource patch: original still invoked once", calls.length === 1);
check("resource patch: native listing suppressed during original call", calls[0].quietDuringCall === true);
check("resource patch: quiet setting restored after call", fakeMode.settingsManager.getQuietStartup() === false);
check("resource patch: renders spacer + summary + spacer", chatChildren.length === 3);
const summary = chatChildren[1];
const collapsed = summary.getCollapsedText();
const expanded = summary.getExpandedText();
const collapsedPlain = stripAnsi(collapsed).replace(/\s+/g, " ").trim();
check("resource summary collapsed shows counts row", /◆ Resources/.test(collapsedPlain) && collapsedPlain.includes("skills 2") && collapsedPlain.includes("tools 2"), collapsedPlain);
check("resource summary collapsed shows context + models + prompts + themes", ["context 1", "models 1", "prompts 1", "themes 1"].every((frag) => stripAnsi(collapsed).includes(frag)), stripAnsi(collapsed));
check("resource summary expands into tables", stripAnsi(expanded).includes("System & Context") && stripAnsi(expanded).includes("Available Tools"), stripAnsi(expanded).slice(0, 200));
check("resource summary: quiet startup skips the patch path", (() => {
	fakeMode.settingsManager.getQuietStartup = () => true;
	const before = calls.length;
	fakeMode.showLoadedResources({ force: false });
	fakeMode.settingsManager.getQuietStartup = () => false;
	return calls.length === before + 1 && chatChildren.length === 3; // original called directly, nothing added
})());

rmSync(tempHome, { recursive: true, force: true });

if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll startup smoke checks passed");
