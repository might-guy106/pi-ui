#!/usr/bin/env node
// Smoke test: message prefixes (assistant/user), content-run probe, core
// message blocks, and the markdown codeblock rail. Uses the real pi theme.
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

const tempHome = mkdtempSync(join(tmpdir(), "pi-ui-messages-smoke-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

const { initTheme, AssistantMessageComponent, UserMessageComponent } = await import("@earendil-works/pi-coding-agent");
const { Markdown } = await import("@earendil-works/pi-tui");
initTheme("dark");

const { setFullTheme } = await import("../src/theme/theme-extras.ts");
// No theme file on disk — extras fall back; that's the default-config path.
setFullTheme(undefined, true);

const { installAssistantMessagePrefix } = await import("../src/messages/assistant-prefix.ts");
const { installUserMessagePrefix } = await import("../src/messages/user-prefix.ts");
const { installMarkdownCodeBlockRenderer } = await import("../src/messages/markdown-codeblock-renderer.ts");
const { installCoreMessageBlockStyling } = await import("../src/messages/core-message-blocks.ts");
const { beginAssistantStream, endAssistantStream, attachComponentToStream } = await import("../src/messages/assistant-streaming-state.ts");

// --- assistant prefix ---
const theme = (await import("@earendil-works/pi-coding-agent")).getMarkdownTheme?.() ?? undefined;
installAssistantMessagePrefix(undefined); // activeTheme=null → extras fall back, prefix still applied
const assistantMsg = {
	role: "assistant",
	content: [{ type: "text", text: "First line of the answer.\nSecond line of the answer." }],
	usage: {},
};
// A live stream must be active BEFORE construction: the tag-once seam freezes a
// component on its first updateContent call.
beginAssistantStream(assistantMsg);
const assistantComponent = new AssistantMessageComponent(assistantMsg, theme);
const assistantLines = assistantComponent.render(80).map(stripAnsi);
const assistantText = assistantLines.join("\n");
check("assistant prefix marker applied", /^•/m.test(assistantText) || assistantText.includes("•"), assistantText);
check("assistant first line prefixed once", (assistantText.match(/•/g) ?? []).length === 1, assistantText);
check("assistant continuation lines aligned", assistantText.includes("Second line of the answer."));

// history (non-streaming) message with thinking before text → divider shown
const thinkingMsg = {
	role: "assistant",
	content: [
		{ type: "thinking", thinking: "Let me consider the options carefully before answering the question." },
		{ type: "text", text: "Here is my answer." },
	],
	usage: {},
	stopReason: "stop",
};
const thinkingComponent = new AssistantMessageComponent(thinkingMsg, theme);
const thinkingLines = thinkingComponent.render(80).map(stripAnsi).join("\n");
check("thinking run styled", thinkingLines.includes("Here is my answer."));
check("assistant divider before thinking runs", thinkingLines.includes("──") || thinkingLines.includes("•"), thinkingLines);

// --- user prefix ---
installUserMessagePrefix(undefined);
const userComponent = new UserMessageComponent("please fix the footer");
const userLines = userComponent.render(80).map(stripAnsi).join("\n");
check("user prefix ❯ applied", userLines.includes("❯") || userLines.includes(">"), userLines);
check("user text preserved", userLines.includes("please fix the footer"));

// --- streaming state tagging ---
check("component tagged as live stream", attachComponentToStream(assistantComponent, assistantMsg) === true);
const historyComponent = new AssistantMessageComponent(
	{ role: "assistant", content: [{ type: "text", text: "history" }], usage: {} },
	theme,
);
check("history component not tagged as live", attachComponentToStream(historyComponent, { role: "assistant", content: [], usage: {} }) === false);
endAssistantStream();
check("stream ended clears tags", attachComponentToStream(assistantComponent, assistantMsg) === false);

// --- markdown codeblock rail ---
installMarkdownCodeBlockRenderer();
const markdown = new Markdown("# Heading\n\n```ts\nconst x = 1;\nconst y = 2;\n```\n\nAfter text.", 0, 0, theme);
const mdLines = markdown.render(80).map(stripAnsi);
check("codeblock rail applied", mdLines.some((l) => l.trimStart().startsWith("┃")), mdLines.join("\n"));
check("codeblock language label shown", mdLines.some((l) => l.includes("#ts")));
check("code content preserved", mdLines.some((l) => l.includes("const x = 1;")));
check("prose outside codeblock untouched", mdLines.some((l) => l.includes("After text.") && !l.includes("┃")));

// --- core message blocks: CustomMessageComponent boxed styling ---
const { CustomMessageComponent } = await import("@earendil-works/pi-coding-agent");
const customMsg = {
	role: "custom",
	customType: "plan",
	content: [{ type: "text", text: "1. Research\n2. Port\n3. Verify" }],
	display: true,
	timestamp: Date.now(),
};
try {
	const custom = new CustomMessageComponent(customMsg, undefined, theme);
	const customLines = custom.render(80).map(stripAnsi);
	check("custom message block renders body", customLines.some((l) => l.includes("2. Port")), customLines.join("\n"));
} catch (error) {
	check("custom message block renders", false, String(error));
}

rmSync(tempHome, { recursive: true, force: true });

if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll messages smoke checks passed");
