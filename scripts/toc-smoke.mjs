#!/usr/bin/env node
// Smoke test: /toc transcript table of contents — user message discovery, row
// measurement, overlay filtering/selection, and the non-fullscreen fallback.
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

const tempHome = mkdtempSync(join(tmpdir(), "pi-ui-toc-smoke-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

const { initTheme, getMarkdownTheme, UserMessageComponent } = await import("@earendil-works/pi-coding-agent");
const { Container, Spacer, Text } = await import("@earendil-works/pi-tui");
initTheme("dark");

const { registerTableOfContentsCommand, setTableOfContentsTui } = await import("../src/navigation/table-of-contents.ts");

const WIDTH = 80;
const messageTexts = [
	"port the loader from pi-droid-styling\nwith a second line of detail",
	"add a retry policy to the client for flaky network calls",
	"fix the login flow on mobile when the session cookie expires",
	"a very long user message that definitely needs to be truncated because it keeps going and going",
];

// --- transcript fixture ----------------------------------------------------
const documentContainer = new Container();
const headerContainer = new Container();
headerContainer.addChild(new Text("banner", 0, 0));
headerContainer.addChild(new Spacer(1));
const chatContainer = new Container();
documentContainer.addChild(headerContainer);
documentContainer.addChild(chatContainer);

const userMessages = [];
chatContainer.addChild(new Spacer(1));
for (const text of messageTexts) {
	const message = new UserMessageComponent(text, getMarkdownTheme());
	userMessages.push(message);
	chatContainer.addChild(new Spacer(1));
	chatContainer.addChild(message);
	// Non-user traffic between messages, so row offsets are not just message heights.
	const assistant = new Container();
	assistant.addChild(new Text(`assistant reply for ${text.split(" ")[0]}`, 0, 0));
	chatContainer.addChild(assistant);
}
chatContainer.addChild(new Spacer(1));

const expectedRow = (target) => {
	let row = headerContainer.render(WIDTH).length;
	for (const child of chatContainer.children) {
		if (child === target) return row;
		row += child.render(WIDTH).length;
	}
	return -1;
};

const scrolls = [];
let renderRequests = 0;
const documentHeight = documentContainer.render(WIDTH).length;
const scrollView = {
	children: [documentContainer],
	contentHeight: documentHeight,
	getContentWidth: () => WIDTH,
	scrollTo(row) {
		scrolls.push(row);
	},
};
const fullscreenTui = {
	mode: "fullscreen",
	terminal: { columns: WIDTH },
	getPrimaryScrollView: () => scrollView,
	requestRender() {
		renderRequests += 1;
	},
};

// --- command registration --------------------------------------------------
const commands = new Map();
registerTableOfContentsCommand({ registerCommand: (name, options) => commands.set(name, options) });
const command = commands.get("toc");
check("toc command registered", Boolean(command));
check("toc command has a description", typeof command?.description === "string" && command.description.length > 0);

function makeContext(tui = fullscreenTui) {
	const notices = [];
	let overlay;
	const ctx = {
		mode: "tui",
		ui: {
			notify(message, type) {
				notices.push({ message, type });
			},
			custom(factory) {
				return new Promise((resolve) => {
					overlay = factory(tui, { fg: (_c, t) => t, bold: (t) => t }, {}, (value) => resolve(value));
				});
			},
		},
	};
	return { ctx, notices, getOverlay: () => overlay };
}

const run = async (context, inputs = []) => {
	const pending = command.handler("", context.ctx);
	for (const input of inputs) context.getOverlay()?.handleInput?.(input);
	await pending;
};

// --- selection and row mapping --------------------------------------------
setTableOfContentsTui(fullscreenTui);

const first = makeContext();
await run(first, ["\r"]);
check("enter jumps to the newest message", scrolls.length === 1 && scrolls[0] === expectedRow(userMessages[3]), JSON.stringify(scrolls));
check("jump requests a render", renderRequests === 1, String(renderRequests));

scrolls.length = 0;
const second = makeContext();
await run(second, ["\x1b[A", "\r"]);
check("arrow navigation jumps to the previous message", scrolls.length === 1 && scrolls[0] === expectedRow(userMessages[2]), JSON.stringify(scrolls));

scrolls.length = 0;
const cancelled = makeContext();
await run(cancelled, ["\x1b"]);
check("escape closes without jumping", scrolls.length === 0, JSON.stringify(scrolls));

// --- filtering -------------------------------------------------------------
scrolls.length = 0;
const filtered = makeContext();
await run(filtered, ["l", "o", "a", "d", "e", "r", "\r"]);
check("substring filter jumps to the matching message", scrolls.length === 1 && scrolls[0] === expectedRow(userMessages[0]), JSON.stringify(scrolls));

// --- overlay rendering -----------------------------------------------------
const view = makeContext();
const overlay = (() => {
	void command.handler("", view.ctx);
	return view.getOverlay();
})();
const overlayLines = overlay.render(WIDTH).map(stripAnsi);
const overlayText = overlayLines.join("\n");
check("overlay lists every user message", overlayLines.filter((line) => /^\s*[›→]?\s*#\d+\s/.test(line)).length === messageTexts.length, overlayText);
check("overlay shows the message text", overlayText.includes("fix the login flow on mobile"));
check("overlay truncates long messages", overlayText.includes("…"));
check("overlay shows the title", overlayText.includes("Table of Contents") && overlayText.includes("4 user messages"));
check("panel shows the configure-key hints", overlayText.includes("move") && overlayText.includes("jump") && overlayText.includes("close"), overlayText);
check("panel shows the search prompt", overlayText.includes("Type to search:"));
// /settings-style layout: search row at the top, key hints at the bottom.
{
	const firstEntry = overlayLines.findIndex((line) => /^\s*[›→]?\s*#\d+\s/.test(line));
	const searchRow = overlayLines.findIndex((line) => line.includes("Type to search:"));
	const hintRow = overlayLines.findIndex((line) => line.includes("move") && line.includes("jump") && line.includes("close"));
	check("panel puts the search row above the list", searchRow >= 0 && firstEntry >= 0 && searchRow < firstEntry, `${searchRow} < ${firstEntry}`);
	check("panel puts the key hints below the list", hintRow > firstEntry, `${hintRow} > ${firstEntry}`);
	check("panel does not repeat the search clue in the hints", !overlayLines[hintRow]?.includes("to search"), overlayLines[hintRow]);
	check("panel capitalizes hint keys like /settings", overlayLines[hintRow]?.includes("Enter jump"), overlayLines[hintRow]);
}
check("panel stays within its width", overlayLines.every((line) => stripAnsi(line).length <= WIDTH), String(Math.max(...overlayLines.map((line) => stripAnsi(line).length))));
// Panel chrome is full width (the renderer mounts it in the editor dock, not as a
// floating box), and the entries sit between the borders.
check("panel borders span the full width", overlayLines[1] === "─".repeat(WIDTH), JSON.stringify(overlayLines[1]?.length));
check("panel has three full-width border rows", overlayLines.filter((line) => line === "─".repeat(WIDTH)).length === 3);

// Mouse clicks reach the list through the panel wrapper.
scrolls.length = 0;
const mouseView = makeContext();
const mousePending = command.handler("", mouseView.ctx);
const mouseLines = mouseView.getOverlay().render(WIDTH).map(stripAnsi);
const clickRow = mouseLines.findIndex((line) => line.includes("fix the login flow on mobile"));
const clickResult = mouseView.getOverlay().handleMouse({
	type: "click",
	button: "left",
	x: 4,
	y: clickRow,
	screenX: 4,
	screenY: clickRow,
	width: WIDTH,
	height: mouseLines.length,
	shift: false,
	alt: false,
	ctrl: false,
});
check("clicking an entry is handled", Boolean(clickResult?.handled), JSON.stringify(clickResult));
await mousePending;
check("clicking an entry jumps to that message", scrolls.length === 1 && scrolls[0] === expectedRow(userMessages[2]), JSON.stringify(scrolls));

// --- opaque containers -----------------------------------------------------
// A message nested in a container that adds its own lines (padding, gaps,
// cropping) must be skipped, not reported with a wrong offset.
const { Box } = await import("@earendil-works/pi-tui");
const boxedDocument = new Container();
const boxedChat = new Container();
const plainMessage = new UserMessageComponent("plain message", getMarkdownTheme());
const paddedBox = new Box(1, 1, (text) => text);
const boxedMessage = new UserMessageComponent("boxed message", getMarkdownTheme());
paddedBox.addChild(boxedMessage);
boxedChat.addChild(plainMessage);
boxedChat.addChild(paddedBox);
boxedDocument.addChild(boxedChat);

const boxedScrolls = [];
const boxedTui = {
	mode: "fullscreen",
	terminal: { columns: WIDTH },
	getPrimaryScrollView: () => ({
		children: [boxedDocument],
		contentHeight: boxedDocument.render(WIDTH).length,
		getContentWidth: () => WIDTH,
		scrollTo(row) {
			boxedScrolls.push(row);
		},
	}),
	requestRender() {},
};
setTableOfContentsTui(boxedTui);
const opaque = makeContext(boxedTui);
await run(opaque, ["\r"]);
check("opaque containers do not produce wrong offsets", boxedScrolls.length === 1 && boxedScrolls[0] === 0, JSON.stringify(boxedScrolls));
const opaqueView = makeContext(boxedTui);
void command.handler("", opaqueView.ctx);
const opaqueText = opaqueView.getOverlay().render(WIDTH).map(stripAnsi).join("\n");
check("messages inside opaque containers are listed once", (opaqueText.match(/#\d+\s/g) ?? []).length === 1, opaqueText);

// --- fallbacks -------------------------------------------------------------
scrolls.length = 0;
const regular = makeContext();
setTableOfContentsTui({ mode: "regular", terminal: { columns: WIDTH }, requestRender() {} });
await run(regular);
check("regular TUI mode reports that jumping needs fullscreen", regular.notices.length === 1 && regular.notices[0].type === "warning", JSON.stringify(regular.notices));
check("regular TUI mode does not jump", scrolls.length === 0);

const emptyTuiNotice = makeContext();
const emptyDocument = new Container();
emptyDocument.addChild(new Text("no messages", 0, 0));
setTableOfContentsTui({
	mode: "fullscreen",
	terminal: { columns: WIDTH },
	getPrimaryScrollView: () => ({ children: [emptyDocument], contentHeight: emptyDocument.render(WIDTH).length, getContentWidth: () => WIDTH, scrollTo() { scrolls.push(-1); } }),
	requestRender() {},
});
await run(emptyTuiNotice);
check("empty session reports no user messages", emptyTuiNotice.notices.length === 1 && emptyTuiNotice.notices[0].type === "info", JSON.stringify(emptyTuiNotice.notices));

const missingTui = makeContext();
setTableOfContentsTui(undefined);
await run(missingTui);
check("missing TUI handle reports a warning instead of throwing", missingTui.notices.length === 1 && missingTui.notices[0].type === "warning");

process.env.HOME = tempHome;
rmSync(tempHome, { recursive: true, force: true });

if (failures > 0) {
	console.error(`\n${failures} check(s) failed`);
	process.exit(1);
}
console.log("\nAll toc smoke checks passed");
