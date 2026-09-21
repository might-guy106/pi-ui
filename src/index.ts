import { InteractiveMode, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerTableOfContentsCommand } from "./navigation/table-of-contents.ts";
import { installStartupUiPatch } from "./startup.ts";
import { setupSessionUI, teardownSessionUI } from "./ui.ts";

export default function (pi: ExtensionAPI) {
	// Compact "◆ Resources …" startup summary replacing pi's native listing.
	installStartupUiPatch(InteractiveMode);

	// `/toc` — transcript table of contents. Registered per process; the handler
	// resolves the live TUI on every invocation.
	registerTableOfContentsCommand(pi);

	pi.on("session_start", async (_event, ctx) => {
		await setupSessionUI(pi, ctx);
	});

	pi.on("session_shutdown", async () => {
		teardownSessionUI();
	});
}
