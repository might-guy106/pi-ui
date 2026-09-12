import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupSessionUI, teardownSessionUI } from "./ui.ts";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		await setupSessionUI(pi, ctx);
	});

	pi.on("session_shutdown", async () => {
		teardownSessionUI();
	});
}
