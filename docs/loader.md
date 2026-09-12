# Working loader

The working indicator (ported from pi-droid-styling's loader-accent, merged with pi-ui's adaptive tones) replaces pi's default spinner while the agent works.

## What you see

- A braille spinner `⣷⣯⣟⡿⢿⣻⣽⣾` at 80 ms.
- A state-aware label with animated dots, refreshed every 400 ms:

| State | Label | When |
|---|---|---|
| `working` | `Working` | Agent starting up |
| `thinking` | `Thinking` | Assistant message has no visible text yet |
| `answering` | `Answering` | Assistant text is streaming |
| `running` | `Running` | A tool call is executing |

- The elapsed time of the current run, e.g. `Answering... 󰅐 12.4s`.

## Adaptive tone

The spinner color tracks how stale the stream is — pi-ui's original feature, kept in the merge:

| Color | Condition |
|---|---|
| green | token received < 10s ago |
| yellow | 10–30s since last token |
| red | > 30s — possible stall |

Labels use the theme's `muted` color; the clock uses `dim`.

## Configure labels

In `~/.pi/agent/pi-ui.json`:

```json
{
  "customWorkingMessage": {
    "working": "Working",
    "thinking": "Thinking",
    "answering": "Answering",
    "running": "Cooking"
  }
}
```

Only the keys you set change; the rest keep the defaults.
