# Configuration

pi-ui reads `~/.pi/agent/pi-ui.json`. The file is created with defaults on first run and missing keys are backfilled. Values are re-read at most once per second.

```json
{
  "userZoneStyle": "gemini",
  "inputBox": { "style": "auto" },
  "presentationStyle": "droid",
  "customWorkingMessage": {
    "working": "Working",
    "thinking": "Thinking",
    "answering": "Answering",
    "running": "Running"
  },
  "alwaysExpanded": false,
  "maxExpandedLines": 50,
  "dimToolOutput": false,
  "extraTools": ["grep", "find", "ls"],
  "footer": true,
  "forceOSC11": false
}
```

## Keys

| Key | Options | Default | What it does |
|---|---|---|---|
| `userZoneStyle` | `droid`, `gemini`, `cli-dock`, `nvim` | `gemini` | Look of the prompt/editor zone and its status rows. Unknown values fall back to `droid`. See [editor-styles](./editor-styles.md). |
| `inputBox.style` | `auto`, `halfblock`, `line`, `solid` | `auto` | Frame drawn around the input text. `auto` uses the style preset's frame (gemini → `halfblock`). `cli-dock` always renders an `outline` box regardless of this setting, and `droid` collapses `line` to no frame. Under `NO_COLOR`, `auto` resolves to `line`. |
| `presentationStyle` | `droid`, `reasonix` | `droid` | Tool rendering language: `droid` = boxed cards with tinted backgrounds, `reasonix` = compact single-row lines, 80% width, no backgrounds. See [tools](./tools.md). |
| `customWorkingMessage` | strings | see above | Rename the working-loader labels. Set only the ones you want to change; empty/missing strings keep the default. |
| `alwaysExpanded` | `true`, `false` | `false` | Open tool results by default. `Ctrl+O` still toggles expansion per session. |
| `maxExpandedLines` | `0`–`1000` | `50` | Cap on expanded tool output lines (keeps the tail). `0` means no limit. |
| `dimToolOutput` | `true`, `false` | `false` | Dim tool output so the conversation stands out. |
| `footer` | `true`, `false` | `true` | With the custom editor active, `true` embeds the status/token line inside the editor zone and hides pi's default footer. `false` keeps pi's default footer visible below the editor. |
| `collapsedThinking` | `tail`, `label` | `tail` | While a thinking run is collapsed, `tail` shows the end of the last thinking line with a live `▸` marker; `label` restores pi's static label. |
| `userPrefix` | `true`, `false` | `false` | Show a `❯` prefix on user messages (with `┆` rails on wrapped lines). |
| `userDivider` | `true`, `false` | `false` | Draw a full-width divider line above each user message. |
| `assistantDivider` | `true`, `false` | `false` | Draw a full-width divider line above each assistant message. |
| `editorPrompt` | `true`, `false` | `false` | Show the `❯`/`›` glyph at the start of the input line. When off, the input keeps a small indent instead. |
| `editorFooter` | `true`, `false` | `false` | Show the editor footer line below the input (cwd left, last reply's token usage `[↑in ↓out R… CH…%]` right) in the `gemini` style. |

| `showProvider` | `true`, `false` | `false` | Show the provider name next to the model in the editor status rows (`databricks-glance system.ai…`). Off by default — only the model id shows. |
| `editorMouse` | `true`, `false` | `true` | Click anywhere in the input to position the text cursor. Enables terminal mouse reporting for the session — terminals then select text with Shift+drag instead of plain drag. Set `false` to keep stock keyboard-only cursor movement. |
| `extraTools` | tool names array | `["grep", "find", "ls"]` | Extra coding tools to activate on top of pi's defaults (`read`, `bash`, `edit`, `write`). pi's `grep` uses **ripgrep** and `find` uses **fd** — both are used from your `PATH` if installed, auto-downloaded by pi otherwise. Set `[]` to keep pi's stock toolset. |
| `forceOSC11` | `true`, `false` | `false` | Force the terminal background sync (OSC 11) on Windows/WSL, where it is skipped by default. See [startup](./startup.md). |

## Examples

Use the Neovim-style dock:

```json
{ "userZoneStyle": "nvim" }
```

Compact boxed look with a plain line frame:

```json
{ "userZoneStyle": "droid", "inputBox": { "style": "line" } }
```

Rename the loader labels only:

```json
{ "customWorkingMessage": { "running": "Cooking" } }
```

Compact conversation (reasonix tool rows):

```json
{ "presentationStyle": "reasonix" }
```
