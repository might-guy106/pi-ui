import { InteractiveMode, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installStartupUiPatch } from "./startup.ts";
import { setupSessionUI, teardownSessionUI } from "./ui.ts";

export default function (pi: ExtensionAPI) {
	// Compact "◆ Resources …" startup summary replacing pi's native listing.
	installStartupUiPatch(InteractiveMode);

	pi.on("session_start", async (_event, ctx) => {
		await setupSessionUI(pi, ctx);
	});

	pi.on("session_shutdown", async () => {
		teardownSessionUI();
	});
}
