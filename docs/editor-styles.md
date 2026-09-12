# Editor styles

The editor zone is rendered by `BoxEditor` (ported from pi-droid-styling's editor). It extends pi's built-in editor, so typing, history, undo, and the slash-command autocomplete behave exactly like stock pi — only the visuals change. Pick a style with `userZoneStyle` in `~/.pi/agent/pi-ui.json` (see [configuration](./configuration.md)).

## `gemini` (default)

A one-line divider above, one status row, half-block framed input, one-line footer.

```
──────────────────────────────────────────────────────────
 openai gpt-test · high │ ━━━━━━░░░░░░ 12k ● 25.0%/48k  ⎇ main [+2] [-1]
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
❯  your message here▊
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
~/project                                        [↑12k ↓1k] ready
```

- Status row: compact `provider model · level` on the left; token meter, context %, git branch with `+/-` LOC on the right.
- Input frame: `▄` bar above and `▀` bar below, rows on the theme's selected background.
- Optional footer (`"editorFooter": true`): cwd on the left; token usage (`[↑in ↓out Rcache CH%]`) right-aligned. Off by default.

## `droid`

The original boxed look: host rule, metadata rows, bold divider.

```
== [user@host] == ⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯
 [env] ~/a…/b/project │ [OPENAI] gpt-test (high)  ⎇ main [+2] [-1]
 [stat] Tokens: ━━━━━━░░░░░░ 12k ● 25.0%/48k ● 42 words/s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❯  your message here▊
```

- Metadata row: `[env]` cwd label, model on a selected-background pill, branch right-aligned.
- Runtime row: token meter with bar, response speed in words/sec.
- Input has no frame by default (`inputBox.style: "line"` keeps a rule, `"halfblock"` adds half-block bars).

## `cli-dock`

An outlined input box with a single status line under it.

```
┌──────────────────────────────────────────────────────────┐
│ ›  Type a prompt or / for commands                       │
└──────────────────────────────────────────────────────────┘
  Deepseek V4 Flash · high | Ctx: 12k/48k | 🌿 main | 📁 project   [↑12k ↓1k]  ✓ ready
```

- Outline box always uses full container width; the status row is inset to align with the text inside the box.
- Status row: model · thinking level, context window, branch, project folder on the left; token usage and extension status (✓ highlighted green) on the right.
- Shows a placeholder when empty.

## `nvim`

A Neovim-style dock: lined input with an optional branch label in the top rule, and a statusline bar below.

```
──── ⎇ main +2 -1 ─────────────────────────────────────────
❯  your message here▊
 HIGH openai · gpt-test          12k/48k 25% · CH 87%  ready
```

- Top rule embeds `⎇ branch +N -M` (unbracketed LOC, gitsigns-style). It degrades by width: full label → name only → plain rule.
- Statusline: left ` THINK ` (reverse-video badge showing the thinking level or `BASH` mode) plus `provider · model`; right side shows `tokens/window ctx% · CH cache-hit%` and the extension status, degrading provider → CH% → tokens → ctx% as width shrinks.

## Prompt glyph

The `❯`/`›` glyph at the start of the input line is **off by default** (`"editorPrompt": false`); the input keeps a small indent instead. Enable it with `"editorPrompt": true` in [config](./configuration.md).

## Input frames

`inputBox.style` overrides the preset frame (except `cli-dock`, which always uses `outline`):

| Frame | Look |
|---|---|
| `auto` | The preset's own frame (gemini → `halfblock`) |
| `halfblock` | `▄` bar above, `▀` bar below, text rows on the selected background |
| `line` | `─` rule above and below (the nvim top rule carries the branch label) |
| `solid` | Text rows on the selected background plus one solid padding row below |
| `outline` | `┌ ─ ┐` box (forced for `cli-dock`) |
| `none` | Bare text, no frame |

Under `NO_COLOR`, `auto` resolves to `line` (the background-based frames are invisible without color).

## Data shown in the zone

All values come from providers wired at session start:

- Model info (provider, id, name, thinking level)
- Context usage (tokens, %, window) from `ctx.getContextUsage()`
- Git branch with staged/unstaged `+/-` LOC, cached with a 5s TTL
- Response speed in words/sec, from message stream events
- Token usage line `[↑in ↓out RcacheRead CH%]` computed from the last assistant message
- Extension status texts (from pi's footer data provider)
