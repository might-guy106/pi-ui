import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type CustomWorkingMessageConfig = Record<"working" | "thinking" | "answering" | "running", string>;

export type InputBoxStyle = "auto" | "halfblock" | "line" | "solid";

export interface InputBoxConfig {
	style: InputBoxStyle;
}

export interface PiUiConfig {
	userZoneStyle: string;
	inputBox: InputBoxConfig;
	customWorkingMessage: CustomWorkingMessageConfig;
	alwaysExpanded: boolean;
	maxExpandedLines: number;
	dimToolOutput: boolean;
	footer: boolean;
	forceOSC11: boolean;
}

const DEFAULT_CUSTOM_WORKING_MESSAGE: CustomWorkingMessageConfig = {
	working: "Working",
	thinking: "Thinking",
	answering: "Answering",
	running: "Running",
};

const DEFAULT_INPUT_BOX: InputBoxConfig = { style: "auto" };

const DEFAULTS: PiUiConfig = {
	userZoneStyle: "gemini",
	inputBox: { ...DEFAULT_INPUT_BOX },
	customWorkingMessage: DEFAULT_CUSTOM_WORKING_MESSAGE,
	alwaysExpanded: false,
	maxExpandedLines: 50,
	dimToolOutput: false,
	footer: true,
	forceOSC11: false,
};

export const USER_ZONE_STYLE_NAMES = ["droid", "gemini", "cli-dock", "nvim"] as const;

const CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-ui.json");
const MAX_EXPANDED_LINES_LIMIT = 1000;

let cached: PiUiConfig = defaultConfig();
let cachedMtimeMs = -1;
let lastStatAt = 0;
const STAT_INTERVAL_MS = 1000;

function defaultConfig(): PiUiConfig {
	return { ...DEFAULTS, inputBox: { ...DEFAULT_INPUT_BOX }, customWorkingMessage: { ...DEFAULT_CUSTOM_WORKING_MESSAGE } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUserZoneStyle(value: unknown): value is typeof USER_ZONE_STYLE_NAMES[number] {
	return typeof value === "string" && (USER_ZONE_STYLE_NAMES as readonly string[]).includes(value);
}

function isInputBoxStyle(value: unknown): value is InputBoxStyle {
	return value === "auto" || value === "halfblock" || value === "line" || value === "solid";
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function maxExpandedLinesOrDefault(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULTS.maxExpandedLines;
	const normalized = Math.floor(value);
	if (normalized < 0) return DEFAULTS.maxExpandedLines;
	return Math.min(normalized, MAX_EXPANDED_LINES_LIMIT);
}

function customWorkingMessageOrDefault(value: unknown): CustomWorkingMessageConfig {
	const labels = { ...DEFAULT_CUSTOM_WORKING_MESSAGE };
	if (!isRecord(value)) return labels;
	for (const key of Object.keys(labels) as Array<keyof CustomWorkingMessageConfig>) {
		const label = value[key];
		if (typeof label === "string" && label.trim().length > 0) labels[key] = label;
	}
	return labels;
}

function inputBoxOrDefault(value: unknown): InputBoxConfig {
	if (!isRecord(value)) return { ...DEFAULT_INPUT_BOX };
	return { style: isInputBoxStyle(value.style) ? value.style : DEFAULT_INPUT_BOX.style };
}

function normalizeConfig(raw: unknown): PiUiConfig {
	if (!isRecord(raw)) return defaultConfig();
	const config = raw as Record<string, unknown>;
	return {
		userZoneStyle: isUserZoneStyle(config.userZoneStyle) ? config.userZoneStyle : DEFAULTS.userZoneStyle,
		inputBox: inputBoxOrDefault(config.inputBox),
		customWorkingMessage: customWorkingMessageOrDefault(config.customWorkingMessage),
		alwaysExpanded: booleanOrDefault(config.alwaysExpanded, DEFAULTS.alwaysExpanded),
		maxExpandedLines: maxExpandedLinesOrDefault(config.maxExpandedLines),
		dimToolOutput: booleanOrDefault(config.dimToolOutput, DEFAULTS.dimToolOutput),
		footer: booleanOrDefault(config.footer, DEFAULTS.footer),
		forceOSC11: booleanOrDefault(config.forceOSC11, DEFAULTS.forceOSC11),
	};
}

function scaffoldIfMissing(): void {
	if (existsSync(CONFIG_PATH)) return;
	try {
		mkdirSync(dirname(CONFIG_PATH), { recursive: true });
		writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig(), null, 2) + "\n", "utf-8");
	} catch {
		// ignore — read path falls back to normalized defaults
	}
}

function backfillMissingDefaults(raw: unknown): void {
	if (!isRecord(raw)) return;
	const config = raw as Record<string, unknown>;
	let changed = false;
	const defaults = defaultConfig();
	for (const key of Object.keys(DEFAULTS) as Array<keyof PiUiConfig>) {
		if (key in config) continue;
		config[key] = defaults[key];
		changed = true;
	}
	if (!changed) return;
	try {
		writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
	} catch {
		// ignore — read path keeps using normalized defaults
	}
}

export function loadConfig(): PiUiConfig {
	const now = Date.now();
	if (now - lastStatAt < STAT_INTERVAL_MS) return cached;
	lastStatAt = now;

	let mtimeMs = -1;
	try {
		mtimeMs = statSync(CONFIG_PATH).mtimeMs;
	} catch {
		scaffoldIfMissing();
		try {
			mtimeMs = statSync(CONFIG_PATH).mtimeMs;
		} catch {
			cached = defaultConfig();
			cachedMtimeMs = -1;
			return cached;
		}
	}

	if (mtimeMs === cachedMtimeMs) return cached;
	cachedMtimeMs = mtimeMs;
	try {
		const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
		cached = normalizeConfig(raw);
		backfillMissingDefaults(raw);
	} catch {
		cached = defaultConfig();
	}
	return cached;
}

export function configPath(): string {
	return CONFIG_PATH;
}
