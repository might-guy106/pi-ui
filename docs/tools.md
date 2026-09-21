# Tools

pi-ui restyles how pi's tool calls and results render in the conversation — boxed badges for the core tools, a boxed fallback for everything else, and a side-by-side diff for edits. Ported from pi-droid-styling; see [porting notes](./porting-notes.md).

## Tool badges

Each core tool gets a boxed call header and a compact result. By default every finished tool call collapses to a single badge row — the tool name, a status icon, the key parameter, and a metrics footer (elapsed time, output size). Clicking the row (or pressing `Ctrl+O`) opens the full output.

| Tool | Badge | Badge shows | Opened shows |
|---|---|---|---|
| bash | `Bash` | `$ command` | the output tail, elapsed time + output size footer |
| read | `Read` | `Path: ~/file.ts:10-50` | numbered, syntax-highlighted file content |
| write | `Write` | `Path` | `↳ Wrote N lines.` |
| edit | `Edit` | `Path`, `+N −M` in the footer | side-by-side split diff (see below) |
| grep | `Search` | `Query: /pattern/ in path` | match lines + `↳ Found N matches.` |
| find | `Find` | `Pattern: *.ts in path` | file list + `↳ Found N files.` |
| ls | `List` | `Path` | item list + `↳ Listed N items.` |

Any other tool (subagent, web search, extension tools) gets the same boxed badge with the tool name and summarized params.

## Collapse behaviour

`collapseToolOutput` in [config](./configuration.md) decides when bash, edit and unstyled tools close:

| Value | While the tool runs | When it finishes |
|---|---|---|
| `onComplete` *(default)* | live preview (bash output tail, edit progress, tool output) | badge |
| `always` | badge | badge |
| `never` | open | open (bash keeps a 5-line tail, edit keeps its 36-row diff) |

- `read`, `write`, `grep`, `find` and `ls` always render as a badge — their output only appears when you open them.
- A **failed** tool never collapses: the error text stays visible.
- `alwaysExpanded: true` keeps everything open, whatever this setting says.
- `Ctrl+O` opens or closes every tool row at once; a click on one row overrides just that row.
- Live output while a tool is running stays visible under `onComplete`; switch to `always` if a long-running command should stay quiet until it finishes.

## Extra tools

pi's default toolset is only `read`, `bash`, `edit`, `write`. pi-ui activates the shipped-but-disabled `grep`, `find`, and `ls` tools on top (configurable via `extraTools` in [config](./configuration.md)):

- `grep` — powered by **ripgrep** (`rg`); used from your `PATH` if installed
- `find` — powered by **fd**; same deal
- `ls` — pure JavaScript

The boxed badges cover all of them (`Search` / `Find` / `List`).

`Ctrl+O` expands a tool result (or `alwaysExpanded: true` in [config](./configuration.md)); `maxExpandedLines` caps how much expanded output renders (keep the tail). Clicking a tool row toggles that one row — the click map is lined up with the drawn rows, so any row of the box works, including the top border.

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
