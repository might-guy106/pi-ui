#!/usr/bin/env node
// Smoke test: /final + shortcut — collapse the transcript down to the final
// response, restore it, and refuse while a response is streaming.
import { mkdtempSync, rmSync } from "node:fs";
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

const tempHome = mkdtempSync(join(tmpdir(), "pi-ui-final-smoke-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

const { initTheme, getMarkdownTheme, AssistantMessageComponent, UserMessageComponent } = await import("@earendil-works/pi-coding-agent");
const { Container, Spacer, Text } = await import("@earendil-works/pi-tui");
initTheme("dark");

const { registerFinalResponseCommand, registerFinalResponseShortcut, setFinalResponseTui } = await import("../src/navigation/final-response.ts");
const { beginAssistantStream, endAssistantStream } = await import("../src/messages/assistant-streaming-state.ts");

const WIDTH = 80;

function assistantMessage(content) {
	const message = { role: "assistant", content, usage: {} };
	beginAssistantStream(message);
	const component = new AssistantMessageComponent(message, getMarkdownTheme());
	endAssistantStream();
	return component;
}

// --- transcript fixture ----------------------------------------------------
// header + chat with: user message, first answer, a tool-like block, then the
// final message (thinking, partial text, final text) and a trailing spacer.
const documentContainer = new Container();
const headerContainer = new Container();
headerContainer.addChild(new Text("banner", 0, 0));
const chatContainer = new Container();
documentContainer.addChild(headerContainer);
documentContainer.addChild(chatContainer);

chatContainer.addChild(new UserMessageComponent("ship the focus mode", getMarkdownTheme()));
chatContainer.addChild(assistantMessage([{ type: "text", text: "FIRST_ANSWER looks good" }]));
const toolLike = new Container();
toolLike.addChild(new Text("TOOL_OUTPUT some tool ran here", 0, 0));
chatContainer.addChild(toolLike);
const finalMessage = assistantMessage([
	{ type: "thinking", thinking: "HIDDEN_THINKING notes" },
	{ type: "text", text: "PARTIAL_TEXT nearly there" },
	{ type: "text", text: "FINAL_RESPONSE the ship goes out" },
]);
chatContainer.addChild(finalMessage);
chatContainer.addChild(new Spacer(1));

const scrolls = [];
const scrollView = {
	children: [documentContainer],
	contentHeight: documentContainer.render(WIDTH).length,
	getContentWidth: () => WIDTH,
	scrollTo(row) { scrolls.push(["to", row]); },
	scrollToEnd() { scrolls.push(["end"]); },
};
const fullscreenTui = {
	mode: "fullscreen",
	terminal: { columns: WIDTH },
	getPrimaryScrollView: () => scrollView,
	requestRender() {},
};

// --- registration ----------------------------------------------------------
const commands = new Map();
const shortcuts = new Map();
const piStub = {
	registerCommand: (name, options) => commands.set(name, options),
	registerShortcut: (key, options) => shortcuts.set(key, options),
};
registerFinalResponseCommand(piStub);
registerFinalResponseShortcut(piStub);
check("final command registered", commands.has("final"));
check("final shortcut registered with alt+g default", shortcuts.has("alt+g"), [...shortcuts.keys()].join(","));

const notices = [];
const ctx = { ui: { notify: (message, type) => notices.push({ message, type }) } };
setFinalResponseTui(fullscreenTui);
const toggle = () => commands.get("final").handler("", ctx);
const transcript = () => stripAnsi(documentContainer.render(WIDTH).join("\n"));

// --- collapse ---------------------------------------------------------------
const beforeText = transcript();
check("fixture shows the full transcript", beforeText.includes("FIRST_ANSWER") && beforeText.includes("TOOL_OUTPUT") && beforeText.includes("FINAL_RESPONSE"));

await toggle();
const collapsedText = transcript();
check("collapse keeps the final response", collapsedText.includes("FINAL_RESPONSE"), collapsedText);
check("collapse hides the earlier answer", !collapsedText.includes("FIRST_ANSWER"), collapsedText);
check("collapse hides tool output", !collapsedText.includes("TOOL_OUTPUT"), collapsedText);
check("collapse hides thinking and partial text", !collapsedText.includes("HIDDEN_THINKING") && !collapsedText.includes("PARTIAL_TEXT"), collapsedText);
check("collapse hides the user message", !collapsedText.includes("ship the focus mode"), collapsedText);
check("collapse hides the header", !collapsedText.includes("banner"), collapsedText);
check("collapse scrolled to the top", scrolls.some(([kind, row]) => kind === "to" && row === 0), JSON.stringify(scrolls));
check("collapse notifies", notices.at(-1)?.message.includes("final response"), JSON.stringify(notices.at(-1)));

// --- restore ----------------------------------------------------------------
await toggle();
const restoredText = transcript();
check("restore brings everything back", restoredText.includes("FIRST_ANSWER") && restoredText.includes("TOOL_OUTPUT") && restoredText.includes("FINAL_RESPONSE"), restoredText);
check("restore scrolled to the end", scrolls.some(([kind]) => kind === "end"), JSON.stringify(scrolls));

// --- streaming guard --------------------------------------------------------
finalMessage.isStreaming = true;
const noticesBefore = notices.length;
await toggle();
check("streaming response is not collapsed", transcript().includes("FIRST_ANSWER") && transcript().includes("TOOL_OUTPUT"));
check("streaming guard notifies", notices.length > noticesBefore && notices.at(-1)?.message.includes("response to finish"), JSON.stringify(notices.at(-1)));
finalMessage.isStreaming = false;

// --- shortcut handler shares the toggle ------------------------------------
const before = transcript();
await shortcuts.get("alt+g").handler(ctx);
check("shortcut collapses too", !transcript().includes("FIRST_ANSWER") && transcript().includes("FINAL_RESPONSE"));
await shortcuts.get("alt+g").handler(ctx);
check("shortcut restores too", transcript().includes("FIRST_ANSWER"));

// --- non-fullscreen fallback -------------------------------------------------
setFinalResponseTui({ mode: "regular", terminal: { columns: WIDTH }, requestRender() {} });
await toggle();
check("non-fullscreen reports the limitation", notices.at(-1)?.message.includes("fullscreen"), JSON.stringify(notices.at(-1)));

rmSync(tempHome, { recursive: true, force: true });
if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll final-response smoke checks passed");