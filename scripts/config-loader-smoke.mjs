#!/usr/bin/env node
// Smoke test: config load/scaffold/normalize + loader state machine + tone logic.
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- config.ts (against a temp HOME so we don't touch the real ~/.pi) ---
// Note: loadConfig() caches stat results for 1s (mtime-based), so the test
// sleeps past the cache window between writes.
const tempHome = mkdtempSync(join(tmpdir(), "pi-ui-config-smoke-"));
const realHome = process.env.HOME;
process.env.HOME = tempHome;

const { loadConfig, configPath } = await import("../src/config.ts");

const scaffolded = loadConfig();
check("config scaffolds file on first read", existsSync(configPath()));
check("config default userZoneStyle is gemini", scaffolded.userZoneStyle === "gemini", String(scaffolded.userZoneStyle));
check("config default inputBox.style is auto", scaffolded.inputBox.style === "auto");
check("config default footer is true", scaffolded.footer === true);

writeFileSync(
	configPath(),
	JSON.stringify({ userZoneStyle: "nvim", inputBox: { style: "solid" }, maxExpandedLines: 5000, customWorkingMessage: { running: "Cooking" } }, null, 2),
);
await sleep(1100);
const loaded = loadConfig();
check("config picks up valid userZoneStyle", loaded.userZoneStyle === "nvim", String(loaded.userZoneStyle));
check("config picks up inputBox.style", loaded.inputBox.style === "solid");
check("config clamps maxExpandedLines", loaded.maxExpandedLines === 1000, String(loaded.maxExpandedLines));
check("config merges custom working message", loaded.customWorkingMessage.running === "Cooking" && loaded.customWorkingMessage.working === "Working");

writeFileSync(configPath(), JSON.stringify({ userZoneStyle: "bogus", inputBox: { style: "bogus" } }));
await sleep(1100);
const normalized = loadConfig();
check("config rejects unknown userZoneStyle", normalized.userZoneStyle === "gemini", String(normalized.userZoneStyle));
check("config rejects unknown inputBox.style", normalized.inputBox.style === "auto");

const raw = JSON.parse(readFileSync(configPath(), "utf-8"));
check("config backfills missing keys to disk", "footer" in raw && "alwaysExpanded" in raw);

process.env.HOME = realHome;
rmSync(tempHome, { recursive: true, force: true });

// --- loader.ts ---
const { toneForElapsed, formatLoaderElapsed, workingStateForAssistantMessage, createMergedWorkingLoader } = await import("../src/loader.ts");
check("tone green under 10s", toneForElapsed(5_000) === "green");
check("tone yellow at 10-30s", toneForElapsed(15_000) === "yellow");
check("tone red over 30s", toneForElapsed(31_000) === "red");
check("elapsed formats seconds", formatLoaderElapsed(1_234) === "1.2s");
check("elapsed formats minutes", formatLoaderElapsed(65_000) === "1m 5s");
check("state: toolCall → running", workingStateForAssistantMessage({ content: [{ type: "toolCall" }] }) === "running");
check("state: text → answering", workingStateForAssistantMessage({ content: [{ type: "text", text: "hi" }] }) === "answering");
check("state: empty → thinking", workingStateForAssistantMessage({ content: [] }) === "thinking");

const frames = [];
const messages = [];
const loader = createMergedWorkingLoader({
	setWorkingIndicator: (options) => frames.push(options),
	setWorkingMessage: (message) => messages.push(message),
});
loader.configure();
loader.start("working");
loader.setState("running");
loader.touch();
loader.stop();
loader.dispose();
check("loader configures indicator frames", frames.length >= 1 && frames[0].frames.length === 8);
check("loader renders state labels", messages.some((m) => m.includes("Working")) && messages.some((m) => m.includes("Running")));

if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll config/loader smoke checks passed");
