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

## Markdown code blocks and quotes

Code blocks render as a full-width background band with an italic `#lang` label, using the theme's syntax highlighting. Quotes render on a dimmer band, italic, in the theme's quote colour:

```
#ts
const x = 1;
```

Neither uses a leading rail character. A rail occupies cells on every line, so it lands in every copied selection; a band sits behind the text and copies as the text alone. Band colours come from the theme's `extras` (`codeBlockBg`, `quoteBandBg`), then from its `export` block (`cardBg`), then from `toolPendingBg` / `customMessageBg`. Long lines wrap inside the band.

The one piece of chrome a selection still copies is the `#lang` label row. Remove that by deleting the `styleCodeBlockLanguage` push in `src/messages/markdown-codeblock-renderer.ts`.

## Streaming-aware rendering

A tag-once streaming seam tracks which message components belong to the live stream (`message_start`/`message_update`/`message_end`). Prefix and thinking-tail rendering use it to distinguish a live stream from history — important because pi-ai partials always carry `stopReason: "stop"`, so `stopReason` alone cannot signal liveness.
