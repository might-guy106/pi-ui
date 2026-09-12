# Configuration

pi-ui reads `~/.pi/agent/pi-ui.json`. The file is created with defaults on first run and missing keys are backfilled. Values are re-read at most once per second.

```json
{
  "userZoneStyle": "gemini",
  "inputBox": { "style": "auto" },
  "customWorkingMessage": {
    "working": "Working",
    "thinking": "Thinking",
    "answering": "Answering",
    "running": "Running"
  },
  "alwaysExpanded": false,
  "maxExpandedLines": 50,
  "dimToolOutput": false,
  "footer": true,
  "forceOSC11": false
}
```

## Keys

| Key | Options | Default | What it does |
|---|---|---|---|
| `userZoneStyle` | `droid`, `gemini`, `cli-dock`, `nvim` | `gemini` | Look of the prompt/editor zone and its status rows. Unknown values fall back to `droid`. See [editor-styles](./editor-styles.md). |
| `inputBox.style` | `auto`, `halfblock`, `line`, `solid` | `auto` | Frame drawn around the input text. `auto` uses the style preset's frame (gemini → `halfblock`). `cli-dock` always renders an `outline` box regardless of this setting, and `droid` collapses `line` to no frame. Under `NO_COLOR`, `auto` resolves to `line`. |
| `customWorkingMessage` | strings | see above | Rename the working-loader labels. Set only the ones you want to change; empty/missing strings keep the default. |
| `alwaysExpanded` | `true`, `false` | `false` | Reserved for tool output expansion (lands with the tool badges phase). |
| `maxExpandedLines` | `0`–`1000` | `50` | Reserved for tool output expansion. `0` means no limit. |
| `dimToolOutput` | `true`, `false` | `false` | Reserved for tool output expansion. |
| `footer` | `true`, `false` | `true` | With the custom editor active, `true` embeds the status/token line inside the editor zone and hides pi's default footer. `false` keeps pi's default footer visible below the editor. |
| `forceOSC11` | `true`, `false` | `false` | Reserved for terminal background sync (lands with the startup/terminal phase). |

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
