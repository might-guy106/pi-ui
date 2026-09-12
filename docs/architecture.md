# Architecture

How pi-ui hooks into pi. Module map of `src/`:

```
src/
├── index.ts              # Extension entry: session_start / session_shutdown
├── ui.ts                 # Session setup: header, editor, footer, loader, event wiring
├── config.ts             # ~/.pi/agent/pi-ui.json — scaffold, backfill, 1s mtime cache
├── loader.ts             # Working loader: braille spinner, state labels, adaptive tone
├── footer.ts             # Legacy standalone footer (fallback when the custom editor is off)
├── footer-patch.ts       # Captures pi's footer data (token usage, statuses) for the editor zone
├── welcome.ts            # Welcome screen: banner + resource grid
├── render-budget.ts      # ANSI-safe width/truncate/wrap fast paths
├── editor/
│   ├── box-editor.ts     # BoxEditor — extends CustomEditor, overrides render() only
│   ├── user-zone.ts      # Style presets (droid/gemini/cli-dock/nvim) + frame resolver
│   └── cluster.ts        # Bottom-anchored multi-component render helper
├── tools/
│   ├── common.ts         # Boxed badge toolkit (droid + reasonix languages)
│   ├── bash/read/write/edit/grep/find/ls.ts  # registerTool overrides for core tools
│   ├── default-badge.ts  # Boxed fallback for unstyled tools (+ supplies hasResult)
│   ├── compact-tool-spacing.ts # Normalizes tool component spacing
│   ├── presentation/     # droid | reasonix design state
│   ├── split-diff.ts     # Side-by-side diff component
│   ├── elapsed.ts        # Elapsed/output metrics annotation
│   ├── register-tool-call-tags.ts # Loads + registers all tool overrides (once)
│   └── resume-tool-refresh.ts     # Re-resolves tool renderers after session resume
├── core/
│   ├── git-status.ts     # Cached git branch + +/- LOC (5s TTL, 1s git timeout)
│   └── assistant-speed.ts# Words/sec tracker fed by message events
├── theme/
│   ├── ansi.ts           # ANSI/RGB/256-color toolkit, background-preserving resets
│   └── theme-extras.ts   # Reads extra theme tokens from the active theme JSON on disk
└── perf/
    └── profiler.ts       # Env-gated (PI_UI_PROFILE=1) metrics — used by render-budget
```

## Lifecycle

1. `session_start` → `setupSessionUI(pi, ctx)`:
   - Load config.
   - Install the footer stats patch (custom editor + `footer: true` only): it sanitizes footer lines, captures the token-usage line and extension statuses, and hides pi's default footer.
   - Tool presentation: set the design (`droid`/`reasonix`), install compact tool spacing + the default badge, install resume refresh, register the tool tag overrides (once per process), and apply `alwaysExpanded`.
   - Create the git branch fetcher and speed tracker.
   - Create the merged working loader and `configure()` it (spinner frames + first label).
   - `ctx.ui.setHeader(...)` → welcome screen.
   - `ctx.ui.setEditorComponent(...)`:
     - custom style → `new BoxEditor(tui, theme, kb, uiTheme, cwd, ...providers)`; the providers close over ctx (context usage, model info) and the fetchers (branch, speed, footer lines).
     - otherwise → stock `CustomEditor` (pi-ui's pre-port minimal editor) plus the legacy footer keeps working.
2. Agent events drive the loader state machine:
   - `before_agent_start` → `setState("working")`
   - `agent_start` → `start("working")`, clear running-tool set
   - `message_start`/`message_update` → `touch()` (tone clock) + `setState(...)` from message content (no visible text → `thinking`, text → `answering`) unless tools are running
   - `tool_execution_start`/`end` → track running tool calls; `running` while any tool is live
   - `agent_end` → `stop()`, reset the working message after 2s
3. `session_shutdown` → `teardownSessionUI()`: dispose the loader, drop session state.

## Hook inventory

Official APIs used: `ctx.ui.setHeader`, `ctx.ui.setEditorComponent`, `ctx.ui.setWorkingIndicator`, `ctx.ui.setWorkingMessage`, `ctx.ui.setFooter` (legacy footer), `pi.on(...)` events, `ctx.getContextUsage()`, `ctx.model`, `ctx.sessionManager`, `pi.getThinkingLevel()`.

Private-but-stable internals used (all feature-detected, degrade gracefully):

- `FooterComponent.prototype.render` (footer stats patch; symbol-marked so extension reloads don't stack).
- `ToolExecutionComponent.prototype` (compact spacing wrapper + default badge: `getRenderContext`, `markExecutionStarted`, `updateResult`, `updateDisplay`, `getCallRenderer`, `getResultRenderer`).
- `InteractiveMode.prototype.renderCurrentSessionState` (resume tool refresh) and `.chatContainer`/`.session` (read-only).
- `Editor` internals read via `as any` for the slash-autocomplete re-render: `state.{lines,cursorLine,cursorCol}`, `autocompleteState`, `autocompleteList.{filteredItems,selectedIndex,maxVisible}`.
- `super.render()` output shape in `Editor.render()` (top border / content / bottom border / autocomplete) — BoxEditor splits at the last border-only line and repaints the zone between.

## Design rules

- Every prototype patch carries a `Symbol.for("pi-ui...")` marker and a version constant, so reloads replace rather than stack.
- Every private access is wrapped in `typeof`/`try` guards: a future pi that renames an internaa degrades to the stock UI instead of crashing.
- Rendering assembles plain text with correct widths first, then applies color — no ANSI-reset leaks, no width drift.
