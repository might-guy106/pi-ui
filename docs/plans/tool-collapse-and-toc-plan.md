# Plan: collapse-all tool calls + `/toc` jump-to-message

Status: approved (review note: use the **public** npm registry — the machine default points at the company artifactory, so pass `--registry=https://registry.npmjs.org` for installs and publishes)
Implementation: complete — `npm run typecheck`, `npm run lint` and `npm test` (6 suites, including the new `scripts/toc-smoke.mjs`) pass. Not yet tested inside a running pi session; see “Manual verification” in section 5.
Target: `@mightguy/pi-ui` 1.7.0 → 1.8.0, against pi 0.85.1 (fullscreen TUI mode)

---

## 1. What the user asked for

1. **All tool calls collapsed by default, click to open.** Today `read`/`write`/`grep`/`find`/`ls` collapse to a 3-row badge, but `bash` keeps a 5-line output tail, `edit` keeps a 36-row split diff, and unknown tools keep a 10-line preview.
2. **A table of contents for a long session** — a slash command that lists the user messages and, when you pick one, scrolls the transcript to it.

Both are pi-ui changes. No pi core changes, no new npm dependencies.

---

## 2. Mechanisms verified in pi 0.85.1 (the basis for both features)

| Mechanism | Where | What it gives us |
|---|---|---|
| Per-call expansion flag | `ToolExecutionComponent.expanded` / `setExpanded()` (`dist/modes/interactive/components/tool-execution.js:21,160`) | Each tool row has its own expanded state — independent of Ctrl+O |
| Click to toggle (already in pi) | `ToolExecutionComponent.createResultRegion()` — wraps **call and result** in `MouseRegion`, handler does `setExpanded(!this.expanded)` (`tool-execution.js:113`) | Left-click behaviour exists; our renderers only need to honour it |
| Renderer contract | `renderResult(result, {expanded, isPartial}, theme, context)`; `context.expanded`, `context.state`, `context.isPartial`, `context.hasResult` (added by pi-ui's default-badge patch) | Call and result renderers can both see "am I expanded" |
| Global expand | `ctx.ui.setToolsExpanded()` (pi-ui `src/ui.ts:141`, config `alwaysExpanded`); Ctrl+O = `app.tools.expand` | Stays the master switch; per-call click overrides a single row |
| Extension-facing TUI is a Proxy | `dist/modes/interactive/tui-renderer.js:43` forwards every property to the live renderer | `(tui as any).getPrimaryScrollView()` reaches the real `TuiAltScreen` |
| Fullscreen transcript | `TuiAltScreen.getPrimaryScrollView()` (`dist/tui-alt-screen.js:141`) → `ScrollView` (`createChatViewport`) | The scroll surface, with `scrollTo(row)` (`dist/components/scroll-view.js:101`) |
| pi scrolls to prompts exactly this way | `TuiAltScreen.scrollToPrompt()` (`tui-alt-screen.js:288`): scan content lines for `OSC133;A`, `scrollView.scrollTo(row)` | Row numbers are **content line indices** — that is the unit we must produce |
| Exact child heights per render | `Container.render()` records `mouseLayout = {width, children:[{component,height}]}` (`@earendil-works/pi-tui/dist/tui.js`) | Row offsets without guessing at padding/gaps |
| User message components | `UserMessageComponent` (pi `…/components/user-message.js`), one direct child of `chatContainer` per message, raw text on `this.text`; `chatContainer` is a plain `Container` | ToC list source; pi-ui already patches this prototype (`src/messages/user-prefix.ts`) |
| `/toc` is free | `BUILTIN_SLASH_COMMANDS` (`dist/core/slash-commands.js`) has `tree` but no `toc` | Command name available |

---

## 3. Part 1 — collapse everything, click to expand

### 3.1 Current per-tool collapsed behaviour

| Tool | Collapsed today | After |
|---|---|---|
| `read`, `write`, `grep`, `find`, `ls` | badge only (footer stashed in `context.state`, result renders nothing) | unchanged |
| `bash` | badge + last 5 output lines + "press Ctrl+o to expand" | badge only (`onComplete`), tail while running |
| `edit` | badge + 36-row split diff | badge with `+N −M` in the footer (`onComplete`), diff while running |
| unknown tools (default badge) | badge + 10 preview lines | badge only (`onComplete`), preview while running |
| any error | full error box | unchanged — **errors never collapse** |

### 3.2 Config

New key in `~/.pi/agent/pi-ui.json`:

```json
{ "collapseToolOutput": "onComplete" }
```

| Value | Meaning |
|---|---|
| `onComplete` *(default)* | Live preview while the tool runs; collapse to the badge as soon as the final result lands |
| `always` | Collapse as soon as any result exists, including partial/streaming output |
| `never` | Legacy look for bash/edit/unknown tools (tail preview, 36-row diff, 10-line preview). `read`/`write`/`grep`/`find`/`ls` keep their existing badge — they were never expanded by default |

Plumbing: `src/config.ts` — type + `DEFAULTS` + validator + `normalizeConfig` entry (follows the existing `booleanOrDefault` pattern, plus a new `collapseModeOrDefault`).

### 3.3 Shared helper

New `src/tools/collapse.ts` (small, single purpose):

```ts
export type CollapseMode = "onComplete" | "always" | "never";
export function shouldCollapseToolResult(opts: {
  expanded: boolean; hasResult: boolean; isPartial: boolean;
}): boolean;
```

Rules: `false` when expanded, when mode is `never`, or when there is no result yet; otherwise `true` for `always`, and `!isPartial` for `onComplete`. Both `renderCall` and `renderResult` call it, so the call badge and the result agree on the state.

### 3.4 Per-file changes

- **`src/tools/common.ts`** — `renderCompactBoxedFooter(theme, result, { state, isError, isPartial, extraParts })`: forward `extraParts` into the existing footer formatter so a collapsed badge can still carry `+N −M` / `⏹ 300s`.
- **`src/tools/bash.ts`** — `renderCall`: when collapsing, emit `renderCompactBoxedToolCall(theme, "Bash", "$ <first command line>", { state, … })`; otherwise today's command box. `renderResult`: error → today's error box; collapsing → `renderCompactBoxedFooter(..., { extraParts: ["⏹ <timeout>s"] })`; expanded → today's full output box. The 5-line tail path stays for the running phase.
- **`src/tools/edit.ts`** — pass `state` into the call badge; `renderResult`: error → today's error box; collapsing → compact footer with `+N −M` extras computed by the existing `countDiffStats`; expanded → split diff (unchanged, `maxRows` 160).
- **`src/tools/default-badge.ts`** — when collapsing, render one compact badge box (footer stashed into `owner.rendererState` via `setCompactBoxedFooter`) instead of call + preview lines. Expanded path unchanged.
- **`src/tools/compact-tool-spacing.ts`** — hit-test fix (below).

### 3.5 Click target fix (why clicks feel unreliable today)

The spacing patch normalizes the rendered lines: for droid it slices from the first `┌` row, dropping the leading `Spacer` row. `Container.render()` has already recorded the *unpatched* child heights in `mouseLayout`, so the parent's hit-test map is one row taller than what is on screen — a click on the top border row lands on the (already dropped) spacer and does nothing. The middle and bottom rows do toggle today.

Fix: have the normalizer report how many lines it dropped at the head and tail (`{ lines, dropLead, dropTail }`) and reconcile `owner.mouseLayout` by consuming those counts from the recorded child heights (clamped at 0). Then every visible row of the tool box dispatches to pi's existing `MouseRegion` → `setExpanded`.

Fallback if this proves fragile while testing: leave the current behaviour (title row and below toggle) and note it; or intercept `ToolExecutionComponent.prototype.handleMouse` to toggle on any left click in the row (rejected as the default because it would swallow OSC 8 link clicks inside tool output).

### 3.6 Edge cases

- **Pending call** (args known, no result yet): no collapsing — keep today's pending box with the command/detail, so a running command is still identifiable.
- **Errors**: always full box, even when collapsed (matches current `read`/`write` behaviour).
- **`alwaysExpanded: true`** still wins: `expanded` is true, so nothing collapses.
- **Ctrl+O** still flips every row (pi sets each `ToolExecutionComponent.expanded`); a click afterwards overrides just that row.
- **Resume / session switch**: pi re-creates tool components; `context.state` is fresh, so the stashed footer is re-set on the next `updateDisplay()`. Existing `installResumeToolRefresh` covers the renderer lookup.
- **Reasonix presentation**: the collapsed row path already goes through `renderReasonixToolRow`; the metrics-row detector still finds `◷`. Verify visually.

---

## 4. Part 2 — `/toc`: jump to a user message

### 4.1 User experience

```
/toc
┌──────────────────────────────────────────────────────────┐
│  Table of Contents · 42 user messages                    │
│  Filter: gemini▏                                         │
│  › #42  add a retry policy to the client                  │
│    #41  the login flow breaks on mobile                   │
│    #37  port the loader from pi-droid-styling             │
│  ↑↓ move · type to filter · enter jump · esc close        │
└──────────────────────────────────────────────────────────┘
```

Picking an entry scrolls the transcript so that message is at the top of the viewport, and closes the overlay. Newest message selected initially (same affordance as pi's `/tree` message list). The footer shows pi's own "Jump to latest message" indicator afterwards, since scrolling up disables follow-end.

### 4.2 How the jump works

1. `pi.registerCommand("toc", { description, handler })` — registered once at extension-factory level in `src/index.ts` (like the tool-tag registration).
2. Handler opens the overlay with `ctx.ui.custom(factory, { overlay: true, overlayOptions })` and gets the live `tui` Proxy in the factory.
3. Resolve the transcript: `tui.mode === "fullscreen"` and `typeof (tui as any).getPrimaryScrollView === "function"` → `scrollView`. Otherwise `ctx.ui.notify("Jump to a message needs fullscreen TUI mode (/settings → TUI mode)", "warning")` and return (regular mode has no `ScrollView`; the terminal owns the scrollback).
4. Width: `width = scrollView.getContentWidth(tui.terminal.columns)`. Self-check with the scroll view's own `contentHeight` from the last layout pass — if `document.render(width).length !== contentHeight`, retry with `columns`, `columns - 1`, `columns - 2`. This is what keeps row offsets from drifting when the scrollbar is `always` / `auto` / `hidden`.
5. Collect entries and rows: render the document (`scrollView.children[0]`) once at `width`, then DFS. Descend only into `Container`s, and read each container's `mouseLayout.children[i].height` (first choice) with `child.render(width).length` as fallback, accumulating rows across the level. A user message is recognised by the marker symbol set on its prototype by `installUserMessagePrefix()` (plus `instanceof UserMessageComponent` as a second signal), its text from `component.text`. Each entry keeps a reference to its **component** and the row.
6. On select, recompute the row for the chosen component (same DFS, one pass) and call `scrollView.scrollTo(row)` + `tui.requestRender()`. Recomputing after the overlay closes means content that arrived while the list was open cannot make the jump land on the wrong message.

Row numbers are exactly the content-line indices pi itself uses in `scrollToPrompt()`, so the unit is right by construction.

### 4.3 Overlay component

`src/navigation/table-of-contents.ts`, built from existing pi-tui parts: `DynamicBorder` (pi-coding-agent) + `Text` title + `Input` filter + `SelectList` + hint line. Key routing: `esc` → close, `↑/↓/enter` → `SelectList`, everything else → `Input` then `selectList.setFilter(input.getValue())`. Items: `value` = entry index, `label` = `#N  <first non-empty line, whitespace-collapsed, truncated>`, `description` = `msg N of M`. The container implements `Focusable` and forwards `focused` to the `Input` (pi's documented IME requirement). `SelectList` already handles mouse clicks, and overlays receive mouse dispatch first, so clicking an entry jumps too.

**Revised during review (the overlay was wrong):** the first build used `ctx.ui.custom(..., { overlay: true })`, which renders a narrow transparent box composited over the middle of the transcript — nothing like pi's own panels. `/toc` now mounts in the editor dock like `/tree` does (`ctx.ui.custom` without `overlay`), and copies the session tree's composition: blank line, full-width `DynamicBorder`, bold title, `Type to search:` row, border, list, border. The search row is rendered text plus a query string held in the component (the same approach `TreeSelectorComponent` uses) instead of an embedded `Input`. `handleMouse` forwards to the container so clicks reach the list.

**Second review pass (hint placement):** the key hints moved from under the title to the last line before the bottom border, in pi's `/settings` style — dim, two-space indent, capitalized key names, `·` separated — and the redundant "type to search" item was dropped because the search row labels itself. `SettingsList` (pi-tui) is the reference: it renders a blank line then `theme.hint("  …")` after the list.

### 4.4 Edge cases

- One message / transcript shorter than the viewport → `scrollTo` clamps; nothing breaks.
- Long or markdown-heavy messages → whitespace-collapsed first line, truncated to the overlay width; the full message is still in the transcript.
- Assistant messages are deliberately not listed (the request is about user prompts; pi's Ctrl+Up/Down already steps through all message starts).
- `/new`, `/tree` navigation, compaction, session resume → the list is rebuilt from the live component tree on every invocation, so it always matches what is on screen.
- Streaming while the overlay is open → handled by recomputing the row at select time.

### 4.5 Files

| File | Change |
|---|---|
| `src/navigation/table-of-contents.ts` | new — collect/measure/scroll + overlay component + command handler |
| `src/index.ts` | register `/toc` at factory level |
| `src/messages/user-prefix.ts` | mark `UserMessageComponent.prototype` with a module symbol so the ToC can identify user messages without relying on class identity across jiti's module graph |

---

## 4.5 Findings during implementation (superseded one plan assumption)

The default badge was **already broken** on pi 0.85.1: `tool-execution.ts` wraps its plain-text fallback child in a `MouseRegion` (`contentTextRegion`), while `installBoxedFallback()` looked for `contentText` directly in `children` — the swap silently never happened, so unstyled tools (subagent, web search, extension tools) rendered as unboxed plain text with the full output and no metrics footer. Because the new collapse behaviour lives in that fallback component, the patch was fixed to swap the child behind the existing click region (falling back to a plain child swap if `createResultRegion` is absent). `scripts/tools-smoke.mjs` now drives a real `ToolExecutionComponent` and asserts the badge renders, hides the output when collapsed, and that a click on the top/bottom row toggles expansion.

---

## 5. Tests

- **`scripts/toc-smoke.mjs`** (new, added to `npm test`): build a `Container` document with real `UserMessageComponent`s plus spacers and a fake assistant block; assert collected rows equal independently computed line offsets; assert row order and label truncation; assert the no-scroll-view path returns the warning instead of throwing.
- **`scripts/tools-smoke.mjs`** (extend): bash collapsed → exactly the 3 badge rows with no command output; bash partial under `onComplete` → preview present; bash partial under `always` → badge; edit collapsed → badge with `+N −M`; errors → never collapsed; `never` → legacy output returns.
- Keep watching for: `npm run typecheck`, `npm run lint`, `npm test`.

Manual verification (fullscreen pi, local install):

1. `pi install /Users/vetcha.nath/Experiments/vetcha-pi-ui`
2. Run a bash command and an edit; confirm both collapse to one badge when finished and that the whole box (including the top border) toggles on click.
3. Ctrl+O expands all; Ctrl+O again collapses all; set `alwaysExpanded: true` and confirm nothing collapses.
4. Flip `collapseToolOutput` to `always` and `never`; confirm the running-phase and legacy behaviours.
5. `/toc` in a long session: filter, jump, verify the chosen message is at the top; check a message near the start and one near the end; check reasonix presentation once.

---

## 6. Docs and release

- `README.md`: features list (collapse-all tool badges, `/toc`), config snippet.
- `docs/tools.md`: collapsed/expanded table + click behaviour + `collapseToolOutput`.
- `docs/configuration.md`: new key with the three values.
- `docs/table-of-contents.md` (new): what it does, keybindings, fullscreen requirement.
- `docs/index.md`, `docs/architecture.md`: link the new page, add the `src/navigation/` module.
- `docs/porting-notes.md`: note the private APIs used (`getPrimaryScrollView`, `mouseLayout`, `ScrollView.scrollTo`, `ToolExecutionComponent.expanded`, `UserMessageComponent.text`) and that they are version-sensitive.
- Version: `npm version minor` → 1.8.0; tag push publishes via GitHub Actions. The user's pi installs `npm:@mightguy/pi-ui`, so publishing is the step that puts this in their normal sessions.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Private pi API drift (`getPrimaryScrollView`, `mouseLayout`, `contentHeight`) | `/toc` stops jumping | Feature-detect every call, notify instead of throwing; row math falls back to `render().length`; documented in porting notes |
| `mouseLayout` reconciliation wrong | Clicks land on the wrong row | Verify by hand against a multi-tool transcript; fallback is leaving today's partial click target in place |
| Collapsing hides output people relied on (bash tails, edit diffs) | Slower review of edits | `collapseToolOutput: "never"` restores it; errors never collapse; edits keep `+N −M` in the badge |
| Row drift from scrollbar width or terminal resize | Jump lands a few lines off | Width self-check against `contentHeight`; row recomputed at select time |
| Reasonix presentation interaction | Odd spacing in compact rows | Check both presentation styles in manual verification |

## 8. Out of scope

Assistant messages in the ToC, `/toc <n>` direct jumps, a ToC keybinding, jumping in regular (non-fullscreen) TUI mode, bookmarks/persistence (pi's `/tree` labels already cover that), and any pi core change.

## 9. Implementation record

Landed as planned, with three additions found while building it:

1. **Default badge was silently disabled on pi 0.85.1** (see section 4.5) — fixed, and covered by a new test that drives a real `ToolExecutionComponent`.
2. **`Container.mouseLayout` reconciliation** in the spacing wrapper, so a click on any drawn row of a tool box (including the top border) toggles it. Verified by a test that fails without the fix.
3. **`collapseToolOutput` also governs unstyled tools**; errors never collapse; `read`/`write`/`grep`/`find`/`ls` keep their existing badge behaviour, and `never` restores the legacy always-open look for bash/edit/unstyled tools.
4. **The ToC panel replaced the overlay** after review (see 4.3): it now mounts in the editor dock and mirrors the session tree's chrome, and its mouse handling was broken in the overlay build (the wrapper had no `handleMouse`, so clicks never reached the list).

Dev-loop reminder: `pi install` treats a local path and `npm:@mightguy/pi-ui` as different packages, so remove the npm entry before installing the checkout, or both copies load at once.
