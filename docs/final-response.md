# Focus mode (`/final`)

Collapse the transcript down to the final response. Built for long sessions where the answer you want is buried under thinking blocks, tool calls, and earlier turns.

```
/final          " toggles
alt+g           " same toggle, from the keyboard
```

## What counts as the final response

The last text run of the last assistant message that has visible text — the answer that comes after all the thinking blocks and tool calls. Boundaries come from pi's own layout: messages and tool executions are top-level turns in the transcript document, and inside the message each text/thinking run is one rendered child.

When you trigger focus mode:

- Every other turn — earlier user and assistant messages, tool executions, headers — renders zero lines.
- Inside the final message, everything but the final text run (thinking, partial text, spacers) renders zero lines.
- The transcript scrolls so the response starts at the top.

Nothing is removed from the tree; components keep their state and simply render nothing while collapsed. Triggering again restores the transcript and scrolls back to the end.

## Limits

- Needs fullscreen TUI mode (`"tuiMode": "fullscreen"`); elsewhere the command tells you so.
- Refuses while the last response is still streaming — the message tree is rebuilt on every token, which would drop the collapse flags.
- Turns that arrive while collapsed render normally below the folded part; toggle to restore.

## Configuration

| Key | Values | Default | Description |
|---|---|---|---|
| `finalResponseShortcut` | key id | `"alt+g"` | Keyboard toggle for focus mode. Any key id pi understands (for example `ctrl+shift+e`). |

The command `/final` always works regardless of the shortcut.