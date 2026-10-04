// Full-width background bands.
//
// Code blocks and quotes are marked with a painted row instead of a leading
// rail character. The rail `┃ ` / `│ ` used two cells per line and those cells
// ended up in every copied selection; a band is painted behind the text, so the
// copy is the text alone.

import { visibleWidth } from "@earendil-works/pi-tui";

import { bgHex, isHexColor } from "./ansi.ts";
import { getThemeColorToken, getThemeExportColor, getThemeExtra } from "./theme-extras.ts";

/**
 * Pick a band colour, in order: theme extra, theme export colour, named theme
 * colour. Returns "" when the theme offers none, which leaves the text unbanded.
 */
export function resolveBandColor(theme: any, extraKey: string, exportKey: string, colorName: string): string {
	const extra = getThemeExtra(theme, extraKey);
	if (isHexColor(extra)) return extra;
	const exported = getThemeExportColor(theme, exportKey);
	if (isHexColor(exported)) return exported;
	const named = getThemeColorToken(theme, colorName);
	return isHexColor(named) ? named : "";
}

/** Paint one row: pad to `width` so the band spans it, then set the background. */
export function paintBand(theme: any, text: string, width: number, color: string): string {
	if (!isHexColor(color)) return text;
	const padding = Math.max(0, width - visibleWidth(text));
	return bgHex(theme, color, text + " ".repeat(padding));
}