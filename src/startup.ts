/**
 * Gradient startup header, ported from pi-droid-styling's startup-ui.ts.
 *
 * Only the official-API half is ported: the gradient "pi" logo + key hints +
 * ready block rendered through ctx.ui.setHeader(), and the console.log filter
 * for pi's "Model scope" startup line. The showLoadedResources monkey-patch
 * is deliberately NOT ported — pi-ui keeps its own welcome resource grid
 * (see src/welcome.ts).
 *
 * The gradient is derived from the active theme's accent color: a cosine wave
 * alternately darkening/lightening the accent across 24 steps, sampled
 * per-character with a per-row phase offset. fgHex() quantizes to 256 colors
 * automatically when the theme runs in that mode.
 */

import { keyHint, rawKeyHint, VERSION } from "@earendil-works/pi-coding-agent";
import { fgHex, parseFgAnsiToRgb, rgbToHex } from "./theme/ansi.ts";
import { safeTruncateToWidth, safeVisibleWidth } from "./render-budget.ts";

const PI_LOGO_LINES = [
	"████████████╗",
	"████████████║",
	"████╔═══████║",
	"████║   ████║",
	"████████╬═══████╗",
	"████████║   ████║ ",
	"████╔═══╝   ████║",
	"████║       ████║",
	"╚═══╝       ╚═══╝",
] as const;

const MESSAGE_TEXT_INDENT = "   ";
const LOGO_PALETTE_STEPS = 24;
const LOGO_MAX_DARKEN = 0.18;
const LOGO_MAX_LIGHTEN = 0.18;
const LOGO_ROW_PHASE_STEP = 0.12;

const FALLBACK_ACCENT_RGB: Rgb = { r: 80, g: 160, b: 255 };

type Rgb = { r: number; g: number; b: number };

export type StartupThemeLike = {
	bold(text: string): string;
	fg(color: string, text: string): string;
	getFgAnsi?(color: string): string;
	getColorMode?(): string;
};

const CONSOLE_LOG_PATCHED = Symbol.for("pi-ui.startup-ui.console-log-patched");

function clampChannel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function interpolateRgb(start: Rgb, end: Rgb, factor: number): Rgb {
	return {
		r: clampChannel(start.r + (end.r - start.r) * factor),
		g: clampChannel(start.g + (end.g - start.g) * factor),
		b: clampChannel(start.b + (end.b - start.b) * factor),
	};
}

function darkenRgb(rgb: Rgb, amount: number): Rgb {
	return {
		r: clampChannel(rgb.r * (1 - amount)),
		g: clampChannel(rgb.g * (1 - amount)),
		b: clampChannel(rgb.b * (1 - amount)),
	};
}

function lightenRgb(rgb: Rgb, amount: number): Rgb {
	return {
		r: clampChannel(rgb.r + (255 - rgb.r) * amount),
		g: clampChannel(rgb.g + (255 - rgb.g) * amount),
		b: clampChannel(rgb.b + (255 - rgb.b) * amount),
	};
}

function buildLogoPalette(accent: Rgb): Rgb[] {
	return Array.from({ length: LOGO_PALETTE_STEPS }, (_, index) => {
		const progress = index / LOGO_PALETTE_STEPS;
		const wave = -Math.cos(progress * Math.PI * 2);
		return wave < 0 ? darkenRgb(accent, LOGO_MAX_DARKEN * -wave) : lightenRgb(accent, LOGO_MAX_LIGHTEN * wave);
	});
}

function sampleLogoGradient(palette: Rgb[], position: number): Rgb {
	const wrapped = ((position % 1) + 1) % 1;
	const scaled = wrapped * palette.length;
	const baseIndex = Math.floor(scaled) % palette.length;
	const nextIndex = (baseIndex + 1) % palette.length;
	return interpolateRgb(palette[baseIndex]!, palette[nextIndex]!, scaled - Math.floor(scaled));
}

function renderLogoGradientLine(theme: StartupThemeLike, line: string, palette: Rgb[], phase: number): string {
	const characters = [...line];
	const span = Math.max(characters.length - 1, 1);
	return characters
		.map((character, index) => {
			if (character === " ") return character;
			const color = sampleLogoGradient(palette, index / span + phase);
			return fgHex(theme, rgbToHex(color), character);
		})
		.join("");
}

let logoGradientCacheKey: string | undefined;
let logoGradientCacheLines: string[] | undefined;

function styledLogoLines(theme: StartupThemeLike): string[] {
	const accentAnsi = theme.getFgAnsi?.("accent") ?? "";
	const mode = theme.getColorMode?.() ?? "truecolor";
	const cacheKey = `${mode}|${accentAnsi}`;
	if (cacheKey === logoGradientCacheKey && logoGradientCacheLines) return logoGradientCacheLines;
	const accent = parseFgAnsiToRgb(accentAnsi) ?? FALLBACK_ACCENT_RGB;
	const palette = buildLogoPalette(accent);
	logoGradientCacheLines = PI_LOGO_LINES.map((line, rowIndex) =>
		renderLogoGradientLine(theme, line, palette, rowIndex * LOGO_ROW_PHASE_STEP),
	);
	logoGradientCacheKey = cacheKey;
	return logoGradientCacheLines;
}

export function logoLines(theme: StartupThemeLike): string[] {
	return styledLogoLines(theme);
}

export function logoWidth(): number {
	return Math.max(...PI_LOGO_LINES.map((line) => safeVisibleWidth(line)));
}

export const STARTUP_TEXT_INDENT = MESSAGE_TEXT_INDENT;

function indentStartupLines(lines: string[]): string[] {
	return lines.map((line) => `${MESSAGE_TEXT_INDENT}${line}`);
}

export function startupBodyWidth(width: number): number {
	return Math.max(1, width - safeVisibleWidth(MESSAGE_TEXT_INDENT));
}

function compactHeader(theme: StartupThemeLike, width: number): string {
	const logoLines = styledLogoLines(theme);
	const logoWidth = Math.max(...PI_LOGO_LINES.map((line) => safeVisibleWidth(line)));
	const gap = "   ";
	const title = theme.bold(theme.fg("accent", "Pi")) + theme.fg("dim", ` v${VERSION}`);
	const hints = [
		theme.bold(rawKeyHint("/", "commands")),
		theme.bold(rawKeyHint("!", "bash")),
		theme.bold(keyHint("app.tools.expand", "more")),
	].join(theme.fg("muted", " · "));
	const status = `${theme.fg("success", "●")} ${theme.bold(theme.fg("success", "ready"))}`;
	const details = [title, hints, status];
	const safeWidth = Math.max(1, width);
	const detailWidth = safeWidth - logoWidth - safeVisibleWidth(gap);

	if (detailWidth >= 12) {
		const detailStartRow = Math.max(0, Math.floor((PI_LOGO_LINES.length - details.length) / 2));
		return logoLines
			.map((styledLine, index) => {
				const logoPadding = " ".repeat(Math.max(0, logoWidth - safeVisibleWidth(PI_LOGO_LINES[index]!)));
				const detailIndex = index - detailStartRow;
				const detail =
					detailIndex >= 0 && detailIndex < details.length
						? safeTruncateToWidth(details[detailIndex]!, detailWidth, "…")
						: "";
				return `${styledLine}${logoPadding}${detail ? `${gap}${detail}` : ""}`;
			})
			.join("\n");
	}

	if (safeWidth >= logoWidth) {
		return [
			...logoLines,
			safeTruncateToWidth(title, safeWidth, "…"),
			safeTruncateToWidth(hints, safeWidth, "…"),
			safeTruncateToWidth(status, safeWidth, "…"),
		].join("\n");
	}

	return [title, status].map((line) => safeTruncateToWidth(line, safeWidth, "…")).join("\n");
}

/** Header block for the welcome screen: gradient logo + title/hints/ready. */
export function renderStartupHeader(theme: StartupThemeLike, width: number): string[] {
	return indentStartupLines(compactHeader(theme, startupBodyWidth(width)).split("\n"));
}

export function suppressStartupModelScopeLog(): void {
	const consoleState = console as typeof console & { [CONSOLE_LOG_PATCHED]?: boolean };
	if (consoleState[CONSOLE_LOG_PATCHED]) return;
	consoleState[CONSOLE_LOG_PATCHED] = true;
	const originalLog = console.log.bind(console);
	console.log = (...args: unknown[]) => {
		const first = typeof args[0] === "string" ? args[0] : "";
		if (first.includes("Model scope:") && first.includes("Ctrl+P to cycle")) return;
		originalLog(...args);
	};
}
