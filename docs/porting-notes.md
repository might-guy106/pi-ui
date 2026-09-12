# Porting notes

pi-ui's editor zone, loader, and theme tooling are ported from [sting8k/pi-droid-styling](https://github.com/sting8k/pi-droid-styling) (MIT). This page records what was ported, what was changed, and what is still planned. See the [port plan](./plans/pi-droid-styling-port-plan.md) for the full research and decision record.

## Ported (Phase 2 — tools + diff)

| Module | Source | Changes on our side |
|---|---|---|
| `src/tools/common.ts` | `tool-tags/common.ts` | Removed an unused width-cache helper (leftover from a removed function). |
| `src/tools/bash.ts`, `read.ts`, `write.ts`, `grep.ts`, `find.ts`, `ls.ts`, `edit.ts` | `tool-tags/*.ts` | Import paths only. `edit.ts` falls back to pi's core edit tool when pi-ctx-kit is absent (its renderers — including the split diff — work either way). |
| `src/tools/default-badge.ts` | `tool-tags/default-badge.ts` | Prototype flags rebranded (`__piUiDefaultBadge*`) so pi-droid-styling and pi-ui can coexist without colliding. |
| `src/tools/compact-tool-spacing.ts` | `tool-tags/compact-tool-spacing.ts` | Patch flags rebranded (`__piUiCompactToolSpacing*`); symbol keys rebranded to `pi-ui.*`. |
| `src/tools/elapsed.ts` | `tool-tags/elapsed.ts` | Result-detail keys rebranded (`__piUiElapsedMs`, `__piUiOutputChars`). |
| `src/tools/register-tool-call-tags.ts` | `tool-tags/register-tool-call-tags.ts` | Dynamic specifiers point at our `.ts` files. |
| `src/tools/resume-tool-refresh.ts` | `tool-tags/resume-tool-refresh.ts` | Symbol keys rebranded; virtualization symbol read kept (harmlessly absent). |
| `src/tools/presentation/*` | `presentation/*` | Symbol key rebranded to `pi-ui.presentation.active-style`. |
| `src/tools/split-diff.ts` | `split-diff.ts` | Import paths only. |

Deliberately not ported from tool-tags: `quick-edit.ts` (renders tools owned by the external pi-ctx-kit extension), `loader-accent.ts` (superseded by our merged `src/loader.ts`).

## Ported (Phase 0 + 1)

| Module | Source | Changes on our side |
|---|---|---|
| `src/editor/box-editor.ts` | `editor/box-editor.ts` | Imports rewired to our layout; renamed the private `renderTopBorder` helper to `renderHostBorder` (pi 0.85's base class added a protected `renderTopBorder(width, hiddenLineCount)`); renamed `customWorkingMessage.running` default from `Cooking` to `Running`. |
| `src/editor/user-zone.ts` | `user-zone/designs.ts` | Verbatim (renamed file). |
| `src/editor/cluster.ts` | `fixed-zone/cluster.ts` | Verbatim (renamed file). |
| `src/loader.ts` | `tool-tags/loader-accent.ts` | Added the adaptive green/yellow/red tone from pi-ui's original indicator and the elapsed-time clock; new `createMergedWorkingLoader`. |
| `src/footer-patch.ts` | `footer-patch.ts` | Renamed patch symbols to `pi-ui.*`; verbatim logic. |
| `src/core/git-status.ts` | `core/git-status.ts` | Import path only. |
| `src/core/assistant-speed.ts` | `core/assistant-speed.ts` | Verbatim. |
| `src/theme/ansi.ts` | `theme/ansi.ts` | Verbatim. |
| `src/theme/theme-extras.ts` | `theme/theme-extras.ts` | Verbatim. |
| `src/perf/profiler.ts` | `performance/profiler.ts` | Env vars renamed `PI_DROID_PROFILE*` → `PI_UI_PROFILE*`. |
| `src/render-budget.ts` | `render-budget.ts` | Import path only. |
| `src/config.ts` | `config.ts` | Our own key set (`userZoneStyle`, `inputBox`, `customWorkingMessage`, `footer`, reserved tool-output keys); same scaffold/backfill/mtime-cache pattern; config file is `~/.pi/agent/pi-ui.json`. |

## Deliberately different

- **Footer**: the editor zone embeds the stats (upstream behavior) only when `footer: true` (default). With the custom editor off, pi-ui's legacy standalone footer keeps working.
- **Welcome screen**: we keep pi-ui's resource-grid welcome screen instead of upstream's compact resource summary.
- **Loader**: merged — upstream's state labels + elapsed clock, plus pi-ui's adaptive tone colors.

## Planned (see the port plan)

- Phase 3: message prefixes (`•` assistant, `❯` user), boxed core-message blocks, markdown codeblock rail, collapsed thinking tail.
- Phase 4: gradient startup header, OSC 11 terminal background.
- Phase 5 (optional): streaming debounce, tool update coalescing, finished-render cache, chat virtualization.

## Version compatibility

- Developed against pi 0.85.1 (matches the installed runtime). Upstream's own feature detection for 0.84+ (fullscreen layout, run-grouped message children) ships with the ported code.
- Verified on 0.85.1 by `scripts/user-zone-smoke.mjs` (70+ render assertions across all four styles, all frames, NO_COLOR, narrow widths, placeholders).

## Credits

Original implementation and design: [pi-droid-styling](https://github.com/sting8k/pi-droid-styling) by sting8k (bean), MIT. The gradient startup header (planned) is inspired by [EnderLiquid/pi-startup-header](https://github.com/EnderLiquid/pi-startup-header).
