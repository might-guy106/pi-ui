# Messages

pi-ui restyles conversation messages — ported from pi-droid-styling (see [porting notes](./porting-notes.md)).

## Assistant prefix

Every assistant turn gets a `•` marker on its first text line, with continuation lines aligned into the gutter:

```
  • First line of the answer.
    Second line of the answer.
```

Thinking blocks render muted and italic. The marker color comes from the active theme's extras (fallback: accent). An optional full-width `───` divider above each assistant turn is available with `"assistantDivider": true` in [config](./configuration.md) (off by default).

## Thinking tail

With `collapsedThinking: "tail"` (default) in [config](./configuration.md), a collapsed thinking run shows the end of the last thinking line with a live marker:

```
  Thinking ▸ …the options are a, b, or c — going with b ▸
```

The trailing `▸` marks a live stream; it becomes `·` once the run finishes. Set `"collapsedThinking": "label"` to restore pi's static label.

## User messages

User messages render as plain text on the theme's message background — no prefix, no surrounding rules (the defaults). Two optional flourishes are available in [config](./configuration.md): `"userPrefix": true` adds a colored `❯` (with `┆` rails on wrapped lines) and `"userDivider": true` draws a divider line above each message.

## Core message blocks

Compaction summaries, skill invocations, branch summaries, and extension custom messages render as boxed blocks with an icon, a label (token count for compaction, skill name, etc.), and a collapsible markdown body — matching the tool-badge visual language.

## Markdown code blocks

Code blocks in any message render with a `┃` rail and an italic `#lang` label, using the theme's syntax highlighting:

```
┃ #ts
┃ const x = 1;
```

Long code lines wrap inside the rail.

## Streaming-aware rendering

A tag-once streaming seam tracks which message components belong to the live stream (`message_start`/`message_update`/`message_end`). Prefix and thinking-tail rendering use it to distinguish a live stream from history — important because pi-ai partials always carry `stopReason: "stop"`, so `stopReason` alone cannot signal liveness.
