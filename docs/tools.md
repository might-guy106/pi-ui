# Tools

pi-ui restyles how pi's tool calls and results render in the conversation — boxed badges for the core tools, a boxed fallback for everything else, and a side-by-side diff for edits. Ported from pi-droid-styling; see [porting notes](./porting-notes.md).

## Tool badges

Each core tool gets a boxed call header and a compact result:

| Tool | Badge | Call shows | Collapsed result shows |
|---|---|---|---|
| bash | `Bash` | shell-syntax-highlighted `$ command` lines | last lines of output, elapsed time + output size footer |
| read | `Read` | `Path: ~/file.ts:10-50` | footer only; expanded = numbered, syntax-highlighted file content |
| write | `Write` | `Path` | footer only; expanded = `↳ Wrote N lines.` |
| edit | `Edit` | `Path` | **side-by-side split diff** (see below) |
| grep | `Search` | `Query: /pattern/ in path` | match lines + `↳ Found N matches.` |
| find | `Find` | `Pattern: *.ts in path` | file list + `↳ Found N files.` |
| ls | `List` | `Path` | item list + `↳ Listed N items.` |

Any other tool gets the default boxed badge (name + summarized params) with the same footer treatment.

`Ctrl+O` expands a tool result (or `alwaysExpanded: true` in [config](./configuration.md)); `maxExpandedLines` caps how much expanded output renders (keep the tail).

## Presentation styles

`presentationStyle` in config picks the visual language:

- `droid` (default) — full-width boxes with tinted backgrounds (`toolSuccessBg` / `toolErrorBg`), inset dividers, and metrics footers (`◷ 1.2s · ✎ ~1.2k words`).
- `reasonix` — compact single rows `<✓ Tool param…>` capped to 80% width, backgrounds stripped, pending spinner `◐◓◑◒`, `└─` metrics connector. Same information, much less vertical space.

## Split diff

Edit results render old and new side by side:

```
 old │ new
   8 │ const a = 1;        │   8 │ const a = 1;
   9 │▌const b = 2;        │   9 │▌const b = 3;
  10 │ export { a, b };    │  10 │ export { a, b };
 +1 −1 [███░░░░░░░░░░░░░░░]
```

- Line numbers on both sides, `▌` change markers
- Word-level inline emphasis on changed spans within a line
- Row backgrounds tinted by mixing the theme's `toolDiffAdded`/`toolDiffRemoved` into the success background
- Per-line syntax highlighting and a `+N −M` proportional meter

## Live config

The tool renderers re-read `~/.pi/agent/pi-ui.json` (once per second at most), so `maxExpandedLines`, `dimToolOutput`, and `presentationStyle` take effect on the next rendered tool without restarting pi.
