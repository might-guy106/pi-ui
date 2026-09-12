export type WorkingLoaderState = "working" | "thinking" | "answering" | "running";
export type WorkingLoaderMessages = Record<WorkingLoaderState, string>;

export interface WorkingLoaderTheme {
	fg?(color: string, text: string): string;
}

export interface WorkingLoaderUi {
	theme?: WorkingLoaderTheme;
	setWorkingMessage(message?: string): void;
	setWorkingIndicator(options?: { frames?: string[]; intervalMs?: number }): void;
}

export interface WorkingLoaderController {
	configure(): void;
	start(state?: WorkingLoaderState): void;
	setState(state: WorkingLoaderState): void;
	stop(): void;
	dispose(): void;
}

export const SPINNER_FRAMES = ["⣷", "⣯", "⣟", "⡿", "⢿", "⣻", "⣽", "⣾"];
export const SPINNER_INTERVAL_MS = 80;
export const WORKING_MESSAGE_INTERVAL_MS = 400;

const WORKING_SPINNER_COLORS = ["accent"];
const WORKING_STATE_LABELS: WorkingLoaderMessages = {
	working: "Working",
	thinking: "Thinking",
	answering: "Answering",
	running: "Running",
};

function themeFg(theme: WorkingLoaderTheme | undefined, color: string, text: string): string {
	if (!theme?.fg) return text;
	for (const fallbackColor of [color, "accent", "text"]) {
		try {
			return theme.fg(fallbackColor, text);
		} catch {}
	}
	return text;
}

function dotsForStep(step: number): string {
	return ".".repeat((Math.max(0, Math.floor(step)) % 3) + 1);
}

function colorForStep(step: number): string {
	const frameIndex = Math.max(0, Math.floor(step)) % SPINNER_FRAMES.length;
	return WORKING_SPINNER_COLORS[frameIndex % WORKING_SPINNER_COLORS.length] ?? "accent";
}

export function renderWorkingMessage(
	state: WorkingLoaderState,
	step: number,
	theme?: WorkingLoaderTheme,
	messages: WorkingLoaderMessages = WORKING_STATE_LABELS,
): string {
	return themeFg(theme, "muted", `${messages[state] ?? WORKING_STATE_LABELS[state]}${dotsForStep(step)}`);
}

export function createWorkingIndicatorFrames(theme?: WorkingLoaderTheme): string[] {
	return SPINNER_FRAMES.map((frame, index) => themeFg(theme, colorForStep(index), frame));
}

export function workingStateForAssistantMessage(message: unknown): WorkingLoaderState {
	const content = (message as { content?: unknown }).content;
	if (!Array.isArray(content)) return "thinking";
	let hasAnswerText = false;
	for (const item of content) {
		if (!item || typeof item !== "object") continue;
		const part = item as { type?: unknown; text?: unknown };
		if (part.type === "toolCall") return "running";
		if (part.type === "text" && typeof part.text === "string" && part.text.trim().length > 0) hasAnswerText = true;
	}
	return hasAnswerText ? "answering" : "thinking";
}

export function createWorkingLoaderController(ui: WorkingLoaderUi, messages?: WorkingLoaderMessages): WorkingLoaderController {
	let state: WorkingLoaderState = "working";
	let step = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	const render = () => {
		ui.setWorkingMessage(renderWorkingMessage(state, step, ui.theme, messages));
	};

	const clearTimer = () => {
		if (!timer) return;
		clearInterval(timer);
		timer = undefined;
	};

	const setState = (nextState: WorkingLoaderState) => {
		if (state === nextState) return;
		state = nextState;
		step = 0;
		render();
	};

	const start = (nextState: WorkingLoaderState = "working") => {
		clearTimer();
		state = nextState;
		step = 0;
		render();
		timer = setInterval(() => {
			step += 1;
			render();
		}, WORKING_MESSAGE_INTERVAL_MS);
	};

	const stop = () => {
		clearTimer();
		state = "working";
		step = 0;
	};

	return {
		configure() {
			ui.setWorkingIndicator({ frames: createWorkingIndicatorFrames(ui.theme), intervalMs: SPINNER_INTERVAL_MS });
			render();
		},
		start,
		setState,
		stop,
		dispose() {
			clearTimer();
		},
	};
}

// ---------------------------------------------------------------------------
// Merged loader: upstream-style state labels + elapsed clock, with the
// adaptive green/yellow/red tone from pi-ui's original working indicator
// (green: token < 10s ago, yellow: 10-30s, red: > 30s — possible stall).
// ---------------------------------------------------------------------------

export type LoaderTone = "green" | "yellow" | "red";

const TONE_THEME_KEYS: Record<LoaderTone, string> = {
	green: "success",
	yellow: "warning",
	red: "error",
};

export function toneForElapsed(ms: number): LoaderTone {
	return ms < 10_000 ? "green" : ms < 30_000 ? "yellow" : "red";
}

export function formatLoaderElapsed(ms: number): string {
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60_000);
	const seconds = Math.floor((ms % 60_000) / 1000);
	return `${minutes}m ${seconds}s`;
}

export interface MergedLoaderOptions {
	messages?: WorkingLoaderMessages;
	/** Called when the spinner needs repainting after a tone change. */
	onToneChange?: () => void;
}

export interface MergedWorkingLoaderController extends WorkingLoaderController {
	/** Record that a token just arrived (resets the tone clock). */
	touch(): void;
}

export function createMergedWorkingLoader(ui: WorkingLoaderUi, options: MergedLoaderOptions = {}): MergedWorkingLoaderController {
	const messages = options.messages;
	let state: WorkingLoaderState = "working";
	let step = 0;
	let tone: LoaderTone = "green";
	let lastTokenTime = Date.now();
	let startTime = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	const applyFrames = () => {
		const toneKey = TONE_THEME_KEYS[tone];
		ui.setWorkingIndicator({
			frames: SPINNER_FRAMES.map((frame) => themeFg(ui.theme, toneKey, frame)),
			intervalMs: SPINNER_INTERVAL_MS,
		});
	};

	const render = () => {
		const elapsed = startTime > 0 ? Date.now() - startTime : 0;
		const clock = elapsed > 0 ? themeFg(ui.theme, "dim", ` 󰅐 ${formatLoaderElapsed(elapsed)}`) : "";
		ui.setWorkingMessage(`${renderWorkingMessage(state, step, ui.theme, messages)}${clock}`);
	};

	const clearTimer = () => {
		if (!timer) return;
		clearInterval(timer);
		timer = undefined;
	};

	const updateTone = () => {
		const next = toneForElapsed(Date.now() - lastTokenTime);
		if (next === tone) return;
		tone = next;
		applyFrames();
		options.onToneChange?.();
	};

	const setState = (nextState: WorkingLoaderState) => {
		if (state === nextState) return;
		state = nextState;
		step = 0;
		render();
	};

	return {
		touch() {
			lastTokenTime = Date.now();
		},
		configure() {
			applyFrames();
			render();
		},
		start(nextState: WorkingLoaderState = "working") {
			clearTimer();
			state = nextState;
			step = 0;
			tone = "green";
			lastTokenTime = Date.now();
			startTime = Date.now();
			applyFrames();
			render();
			timer = setInterval(() => {
				step += 1;
				updateTone();
				render();
			}, 100);
		},
		setState,
		stop() {
			clearTimer();
			state = "working";
			step = 0;
			startTime = 0;
		},
		dispose() {
			clearTimer();
		},
	};
}
