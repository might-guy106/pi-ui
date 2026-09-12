# Port Plan: pi-droid-styling → @mightguy/pi-ui

Status: approved (review note: no pi version restriction — target the runtime version; if npm resolves `@earendil-works/*` against the org artifactory registry, install with `--registry=https://registry.npmjs.org`)
Source studied: https://github.com/sting8k/pi-droid-styling (v2.13.0, MIT, ~12.4k lines, 45+ modules)
Our package: @mightguy/pi-ui v1.2.3 — dev env upgraded to pi 0.85.1 to match the installed runtime (global pi 0.85.1).

---

## 1. How our package works today

One pi extension (`src/index.ts`) that wires five things on `session_start`:

| Feature | File | How it hooks in |
|---|---|---|
| Status bar (footer) | `src/footer.ts` | `ctx.ui.setFooter()` — single line: model, thinking level, cwd, git branch, context %, cost. Truncation ladder when narrow. Second line lists extension statuses with a numbered icon series. |
| Welcome screen | `src/welcome.ts` | `ctx.ui.setHeader()`. Temporarily removes pi's native resource panel from the TUI tree, parses its text (Context/Skills/Prompts/Extensions), renders our own responsive 1/2/3-column grid. Restores the native panel on any parse failure. |
| Minimal editor | `src/ui.ts` | `ctx.ui.setEditorComponent()` — pi's stock `CustomEditor` (rules above/below the prompt). |
| Working indicator | `src/ui.ts` | `pi.on('agent_start'/'message_update'/'agent_end')` + `ctx.ui.setWorkingIndicator()`. Spinner turns green→yellow→red based on time since last token; working message shows elapsed time. |
| Theme | `themes/catppuccin-dark.json` | Registered via `pi.themes` in package.json. Catppuccin Mocha, 64+ mappings. |

Plus an assistant message renderer (`registerMessageRenderer`) and an npm release workflow (tag push → GitHub Actions → npm).

No config file, no tool rendering, no message styling, no performance work.

## 2. What pi-droid-styling provides

Three subagents did a module-by-module analysis, verified against our installed pi 0.76.0.

### A. Editor / "user zone" — the headline look
- `BoxEditor` **extends** pi's `CustomEditor` and overrides only `render()`. Input and key handling stay stock. Hooked through the official `ctx.ui.setEditorComponent()`.
- 4 style presets (pure config): **droid** (host rule + metadata rows + bold divider), **gemini** (default; one status row + `▄▀` half-block frame), **cli-dock** (outline box + status line below), **nvim** (lined frame with branch label + reverse-video statusline bar with width-rung degradation).
- Input frames: `auto / none / halfblock / line / solid / outline`.
- Data providers injected as closures: context usage, model info, git branch (+/- LOC), words/sec, token-usage line, status line.
- `footer-patch` hides pi's default footer and hands its data to the editor — the footer lives inside the editor zone.

### B. Startup
- Gradient ASCII "pi" logo via the official `ui.setHeader()` — clean and safe.
- Compact resource summary by monkey-patching `InteractiveMode.showLoadedResources` (private) + temporarily forcing `getQuietStartup()` to true + a `console.log` filter to suppress the "Model scope" line. Expandable "System & Context" and "Available Tools" tables.

### C. Conversation styling
- Assistant prefix `•` + full-width turn divider + restyled thinking (muted italic, optional collapsed one-row tail).
- User prefix `❯` on `userMessageBg`, continuation rows get `┆` rails.
- Boxed blocks for compaction / skill invocation / branch summary / custom messages.
- Markdown code blocks rendered with a `┃` rail and italic `#lang` label.

### D. Tool tags
- Boxed tool badges for bash, read, write, grep, find, ls via `pi.registerTool` overrides (extension-level, not patching). Default-badge catch-all styles any other tool (and supplies `hasResult`, which 0.76 does not).
- Elapsed time + output-size metrics footers; pending spinners; two visual languages: **droid** (boxed) and **reasonix** (single compact row, 80% width).
- Side-by-side split diff component: `old │ new` with line numbers, tinted backgrounds, word-level emphasis, `+N −M [██░░]` meter.

### E. Loader
- Braille spinner (80 ms) + state-aware labels: Working / Thinking / Answering / Cooking (400 ms cycle), all renameable via config.

### F. Themes / terminal
- Companion theme bundle (pi-themes), theme-extras (reads the active theme JSON from disk for extra tokens), OSC 11 terminal background sync, optional full-page background painting.

### G. Performance
- Essential: assistant streaming debounce (33 ms ticks), tool update coalescing (80 ms), finished-render cache, ANSI-safe render helpers.
- Optional: render width guard, render throttle, profiler, chat virtualization.
- Skip-list (fragile or dormant on 0.76): render-physical-sync, render-frame-debug, streaming-markdown-cache (its `stopReason` gate always bypasses on 0.76), autowrap guard, TUI padding.

### H. Config
- `~/.pi/agent/pi-droid-styling.json`, auto-scaffolded, backfilled with defaults, mtime-cached (1 s). Clean pattern worth copying.

### Compatibility (dev env upgraded to 0.85.1 during review; original analysis verified 0.76.0, re-verified 0.85.1 for Phase 1 hooks)
- **Safe:** `setEditorComponent`, `setHeader`, `setWorkingIndicator/Message`, `registerTool` + all 7 core tool factories, all events used, `Theme.fg/bg/getFgAnsi/getBgAnsi/getColorMode`, `Markdown/Text/Box.setBgFn`, `ctx.getContextUsage()`, `sessionManager.getEntries()`, `session.getToolDefinition`, resource loader, `getAllTools` + source info.
- **Private but present (runtime-patchable):** `Editor.state/autocompleteList`, `AssistantMessageComponent.contentContainer`, `ToolExecutionComponent` internals, `InteractiveMode.chatContainer/showLoadedResources/renderCurrentSessionState`, `TUI.doRender/applyLineResets/...`, `FooterComponent` internals, `Markdown.renderToken`.
- **Absent in 0.76:** `InteractiveMode.themeController` (companion-themes reapply silently no-ops), `thinkingVisibilityOverrides`, fullscreen layout root (0.84+), TUI Proxy (0.84+), `hasResult` in `getRenderContext` (the default-badge patch supplies it).
- Upstream itself is disciplined: Symbol patch markers prevent reload stacking, `typeof` guards, try/catch teardown, graceful degradation everywhere.

## 3. What to bring, and how

### Recommendation summary

| Tier | Feature | Verdict | Size | Risk |
|---|---|---|---|---|
| 1 | BoxEditor + user-zone presets + input frames | **Bring** — the look you liked | L | medium |
| 1 | git-status + assistant-speed providers | **Bring** | M, S | low |
| 1 | Footer merge into editor | **Bring** (keep our footer as fallback) | M | low |
| 1 | Loader (braille + state labels) | **Bring**, merged with our green/yellow/red tone logic | S | low |
| 1 | Tool badges (7 registerTool overrides + default-badge) | **Bring** | L total | medium |
| 1 | Split diff | **Bring** — isolated, all APIs verified | M/L | low |
| 1 | Config module (`~/.pi/agent/pi-ui.json`) | **Bring** | S | none |
| 2 | User prefix `❯`, boxed core-message blocks, codeblock rail | **Bring** | M each | low-medium |
| 2 | Presentation styles droid/reasonix | **Bring** (pure state module) | S | none |
| 2 | Assistant prefix `•` + thinking tail | **Bring with care** — probe-based, heaviest private surgery | L | medium-high |
| 3 | Gradient startup logo | **Bring** (official API) | M | low |
| 3 | OSC 11 terminal background | **Bring** | S | low |
| 3 | theme-extras + ansi toolkit | **Bring** — many modules depend on them | M | low |
| 3 | Compact resource summary (replaces pi's resource list) | **Defer** — we already have a richer welcome grid; private-API heavy | M | medium-high |
| 4 | Streaming debounce, tool debounce, finished-render cache, width guard | **Bring** (phase 5, optional) | M/L,S,M,S | medium |
| — | Virtualize-chat, physical-sync, frame-debug, tui-padding, pi-tasks widget, companion-themes bundle, quick-edit (external dep) | **Skip / defer** | — | — |

### Target structure

```
src/
├── index.ts              # entry: event wiring, lifecycle, disposal
├── session-modules.ts    # lazy-import barrel (keep session_start light)
├── config.ts             # ~/.pi/agent/pi-ui.json: scaffold + backfill + mtime cache
├── ui.ts                 # working indicator/loader (merged tone + labels)
├── footer.ts             # existing footer, kept as fallback when editor off
├── welcome.ts            # existing welcome grid (kept)
├── editor/
│   ├── box-editor.ts     # port of upstream BoxEditor (render() override only)
│   └── user-zone.ts      # 4 presets + frame resolver + cluster helper
├── core/
│   ├── git-status.ts     # cached branch + +/- LOC (5s TTL, 1s timeout)
│   └── assistant-speed.ts
├── tools/
│   ├── common.ts         # badge toolkit (boxed + reasonix languages)
│   ├── register.ts       # bash/read/write/grep/find/ls overrides + default badge
│   ├── presentation.ts   # droid | reasonix state
│   └── split-diff.ts     # side-by-side diff component
├── messages/
│   ├── user-prefix.ts
│   ├── assistant-prefix.ts
│   ├── core-message-blocks.ts
│   ├── codeblock.ts
│   └── streaming-state.ts
├── theme/
│   ├── ansi.ts           # ANSI/RGB/256 toolkit, background-preserving resets
│   ├── theme-extras.ts   # read theme JSON extras from disk
│   └── terminal-bg.ts    # OSC 11
└── perf/                 # phase 5 (optional)
    ├── render-budget.ts
    ├── debounce-update.ts
    ├── debounce-tool-updates.ts
    ├── finished-render-cache.ts
    └── width-guard.ts
```

### Phases

- **Phase 0 — foundations + docs.** Docs restructure with `docs/index.md` as the navigation hub (see §4). Config module. `theme/ansi.ts` + `perf/render-budget.ts` helpers. Smoke-test harness pattern (port upstream's `scripts/*-smoke.mjs` idea) wired into `npm test`. Typecheck already exists.
- **Phase 1 — editor user zone.** BoxEditor + presets + frames, git-status, assistant-speed, footer merge, merged loader. Config keys: `userZoneStyle`, `inputBox.style`, `customWorkingMessage`. This is the phase that changes what you see every day; ship it alone and live with it a bit.
- **Phase 2 — tools + diff.** Badge toolkit, 7 tool overrides, default-badge, presentation styles, split-diff (edit tool result renders side-by-side).
- **Phase 3 — conversation.** User prefix, core-message blocks, codeblock rail, then assistant prefix + thinking tail (riskiest — keep upstream's layout probe and pin rendering tests before touching it).
- **Phase 4 — startup + terminal.** Gradient logo header, OSC 11 background sync.
- **Phase 5 — performance (optional).** Debounces, render cache, width guard, profiler.

Each phase: `npm run typecheck` + smoke tests + a manual `pi install ./` visual check, then a separate PR (small PRs beat large ones).

### Guardrails (non-negotiable)

1. Target pi 0.85.x (the installed runtime). Keep upstream's feature detection and `typeof` guards so older/newer pi degrade gracefully; never crash.
2. Symbol-keyed patch markers on every prototype patch so extension reloads don't stack wrappers (upstream's pattern).
3. Keep peer deps `"*"`; never call an API without a guard if it's absent in 0.76.
4. Credit sting8k/pi-droid-styling (MIT) in README and file headers for ported modules.

## 4. Docs plan (with `docs/index.md`)

```
docs/
├── index.md              # NEW: navigation hub — one annotated link per page below
├── development.md        # existing: local setup, publishing, secrets, troubleshooting
├── configuration.md      # NEW: every config key, defaults, examples
├── editor-styles.md      # NEW: the 4 user-zone styles + input frames (with ASCII previews)
├── tools.md              # NEW: tool badges, split diff, presentation styles
├── messages.md           # NEW: prefixes, blocks, codeblock rail, thinking tail
├── performance.md        # NEW: what the perf patches do, when to enable, profiling
├── architecture.md       # NEW: module map, hook inventory (official vs private), lifecycle
├── porting-notes.md      # NEW: what was ported from pi-droid-styling, version caveats, credits
└── plans/                # decision records (this file lives here)
```

`index.md` format: title, one-paragraph package summary, then a table of contents grouped by audience (Use → Configure → Develop → Understand), each row: link + one-line description. README links to `docs/index.md` instead of deep-linking individual files.

## 5. Review decisions

Resolved during plan review: no pi version restriction — dev env and target bumped to 0.85.1 (matches runtime); npm installs of `@earendil-works/*` use the public registry. Default editor style: `gemini` (upstream default), footer embedded in the editor zone with our standalone footer as fallback, welcome screen kept as-is, performance phase deferred, config file `~/.pi/agent/pi-ui.json`, both presentation styles ported.

## Open questions (decide in review)

1. **Default editor style after install:** `gemini` (upstream default), `droid`, or keep our current minimal editor as default and make the new zone opt-in via config? (Suggest: default `gemini` — you asked for the look; `classic` remains one config key away.)
2. **Footer:** hide pi's default footer and embed stats in the editor zone (upstream behavior), or keep our standalone footer when the custom editor is off? (Suggest: embed when BoxEditor active, fall back to our footer otherwise.)
3. **Welcome screen:** keep our resource grid, or also port the compact resource summary? (Suggest: keep ours for now; revisit later.)
4. **Phase 5 performance:** include now or defer? (Suggest: defer until Phase 1–4 feel right; the debounces are the only ones with user-visible wins on 0.76.)
5. **Config file name:** `~/.pi/agent/pi-ui.json` — OK?
6. **Reasonix presentation style:** port both visual languages or droid-only? (Suggest: both — it's one small state module and two render paths in the badge toolkit.)

## 6. Risks

| Risk | Mitigation |
|---|---|
| Private API renames in future pi versions silently disable features | Feature detection + graceful fallback + smoke tests pinned to `showLoadedResources`, `Editor` internals, border detection |
| BoxEditor's border-split heuristic depends on stock `Editor.render()` output | Verified present in 0.76.0; add defensive fallback to stock autocomplete path |
| Streaming debounce interacts with 0.76's per-delta Markdown rebuild | Port upstream's design as-is; it was written against this exact behavior |
| Tool output format coupling (read tool parsing) | Contained in one module per tool; format changes fail soft to the default badge |
| Scope creep — 12k lines upstream | Strict tier table above; anything not listed needs a new decision record |
