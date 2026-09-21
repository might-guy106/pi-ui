import { loadConfig } from "../config.ts";
import type { CollapseToolOutput } from "../config.ts";

export type CollapseDecision = {
	mode: CollapseToolOutput;
	collapse: boolean;
};

export function collapseMode(): CollapseToolOutput {
	return loadConfig().collapseToolOutput;
}

/**
 * Whether a tool row should render as a collapsed badge instead of showing its
 * output. Shared by renderCall and renderResult so the call badge and the
 * result stay in the same state.
 *
 * - an explicitly expanded row never collapses
 * - failures stay open so the error text is always visible
 * - a row without a result keeps its call details (pending/running)
 * - "always" collapses as soon as a result exists, including partial output
 * - "onComplete" keeps the live preview and collapses when the final result lands
 * - "never" keeps the legacy per-tool preview
 */
export function shouldCollapseToolResult(options: {
	expanded: boolean;
	hasResult: boolean;
	isPartial: boolean;
	isError?: boolean;
}): CollapseDecision {
	const mode = collapseMode();
	if (options.expanded || options.isError || mode === "never" || !options.hasResult) return { mode, collapse: false };
	if (mode === "always") return { mode, collapse: true };
	return { mode, collapse: !options.isPartial };
}
