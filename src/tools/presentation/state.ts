import {
	DEFAULT_PRESENTATION_STYLE,
	getPresentationDesignFor,
	isPresentationStyleName,
	type PresentationDesign,
	type PresentationStyleName,
} from "./designs.ts";

const ACTIVE_PRESENTATION_STYLE = Symbol.for("pi-ui.presentation.active-style");
const runtimeState = globalThis as Record<PropertyKey, unknown>;

export function setPresentationStyle(style: PresentationStyleName): void {
	runtimeState[ACTIVE_PRESENTATION_STYLE] = style;
}

export function getPresentationStyle(): PresentationStyleName {
	const style = runtimeState[ACTIVE_PRESENTATION_STYLE];
	return isPresentationStyleName(style) ? style : DEFAULT_PRESENTATION_STYLE;
}

export function getPresentationDesign(): PresentationDesign {
	return getPresentationDesignFor(getPresentationStyle());
}

