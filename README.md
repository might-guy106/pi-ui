<p align="center">
  <img src="https://img.shields.io/badge/pi--ui-🖥️-89B4FA?style=for-the-badge" alt="pi-ui" height="48">
</p>

<p align="center">
  <strong>Custom Terminal UI for <a href="https://github.com/earendil-works/pi-coding-agent">pi</a> Coding Agent</strong>
  <br>
  <sub>Beautiful themes, smart status bar, and enhanced message rendering</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mightguy/pi-ui"><img src="https://img.shields.io/npm/v/@mightguy/pi-ui?style=flat-square&color=CB3837"></a>
  <a href="./docs/index.md"><img src="https://img.shields.io/badge/Docs-📚-89B4FA?style=flat-square"></a>
  <a href="./docs/development.md"><img src="https://img.shields.io/badge/Dev_Guide-📖-89B4FA?style=flat-square"></a>
</p>

---

## 📋 Features

- 🎛️ **Editor user zone** — the prompt area becomes a styled zone with 4 presets (`droid`, `gemini`, `cli-dock`, `nvim`): model, thinking level, context meter, git branch with +/- LOC, response speed, and token usage rendered right around your input — ported from [pi-droid-styling](https://github.com/sting8k/pi-droid-styling)
- 🧰 **Tool badges** — boxed call/result badges for bash, read, write, edit, grep, find, and ls, with elapsed time, output size, collapsed previews, and a side-by-side split diff for edits; `reasonix` compact-row mode optional
- 💬 **Message styling** — `•` assistant prefix, muted thinking with a live collapsed-tail view, boxed compaction/skill/branch blocks, and a `┃`-railed codeblock renderer; user messages stay plain (optional `❯` prefix and turn dividers in config)
- 🌈 **Gradient startup** — 9-row gradient "pi" logo derived from your theme accent, key hints, ready indicator, and OSC 11 terminal background sync so the whole window matches the theme
- 🖥️ **Custom Status Bar** — real-time footer showing model, thinking level, cwd, git branch, context usage (%), and API cost (used when the custom editor is off)
- 🎨 **Catppuccin Dark Theme** — Dark theme based on [Catppuccin Mocha](https://github.com/catppuccin/catppuccin) with 64+ color mappings
- ⏳ **State-aware Working Loader** — braille spinner with labels that follow the work (Working / Thinking / Answering / Running), elapsed time, and adaptive green→yellow→red tone when the stream stalls
- 🌟 **Welcome Screen** — Custom startup header with pi banner and resource grid (Context, Skills, Prompts, Extensions)
- ⚙️ **Zero-config** — sensible defaults, optional config at `~/.pi/agent/pi-ui.json`
- 🔌 **Zero Dependencies** — Pure peer-dependency package; no additional npm packages required
- ⚡ **TypeScript Native** — Loaded directly via [jiti](https://github.com/unjs/jiti) — no build step needed

## 📦 Installation

```bash
pi install npm:@mightguy/pi-ui
```

Or from GitHub:

```bash
pi install git:github.com/might-guy106/pi-ui
```

## 🚀 Usage

Once installed, pi-ui works **automatically** — no configuration required. On session start the editor zone, footer, spinner, welcome screen, and message renderer are all registered.

Pick an editor style in `~/.pi/agent/pi-ui.json`:

```json
{ "userZoneStyle": "gemini" }
```

### Editor styles

| Style | Look |
|---|---|
| `gemini` *(default)* | One-line divider, status row, half-block framed input, one-line footer |
| `droid` | Host rule `[user@host] ==`, metadata rows, bold divider |
| `cli-dock` | Outlined input box with placeholder + single aligned status line |
| `nvim` | Lined input with branch label in the rule + reverse-video statusline bar |

See [docs/editor-styles.md](./docs/editor-styles.md) for previews and [docs/configuration.md](./docs/configuration.md) for every option.

### Working Loader

Braille spinner (⣷⣯⣟⡿⢿⣻⣽⣾) with a state label and elapsed time:

```
Answering... 󰅐 12.4s
```

## 🎨 Themes

```
/theme catppuccin-dark
```

## 🏗️ Project Structure

```
pi-ui/
├── src/
│   ├── index.ts     # Extension entry
│   ├── ui.ts        # Session setup — header, editor, footer, loader, events
│   ├── config.ts    # ~/.pi/agent/pi-ui.json config
│   ├── loader.ts    # Working loader (spinner + state labels + tone)
│   ├── footer.ts    # Legacy standalone footer (fallback)
│   ├── footer-patch.ts # Footer data capture for the editor zone
│   ├── welcome.ts   # Welcome screen header and resource grid
│   ├── editor/      # BoxEditor + style presets + cluster helper
│   ├── tools/       # Tool badges, split diff, presentation styles
│   ├── messages/    # Prefixes, boxed blocks, codeblock rail, streaming seam
│   ├── startup.ts   # Gradient pi logo header + clean startup
│   ├── core/        # git status, response speed
│   ├── theme/       # ANSI toolkit, theme extras, OSC 11 background sync
│   └── perf/        # Profiler (PI_UI_PROFILE=1)
├── themes/
│   └── catppuccin-dark.json
├── scripts/         # Smoke tests (npm test)
├── docs/            # Docs — start at docs/index.md
└── .github/
    └── workflows/
        └── release.yml
```

## 🛠️ Development

See [docs/index.md](./docs/index.md) for the documentation map, [docs/development.md](./docs/development.md) for the dev and publishing workflow.

## Credits

This project is a fork of [DragonYH/pi-ui](https://github.com/DragonYH/pi-ui), originally published as [`@rokiy/pi-ui`](https://www.npmjs.com/package/@rokiy/pi-ui).

The welcome screen is ported from [pi-kaush/pi-welcome-screen](https://github.com/might-guy106/pi-kaush) by the same author.

The editor user zone, working loader, and theme tooling are ported from [sting8k/pi-droid-styling](https://github.com/sting8k/pi-droid-styling) — see [docs/porting-notes.md](./docs/porting-notes.md).

## 📄 License

[MIT](./LICENSE)

---

<p align="center">
  <sub>Built for the <a href="https://github.com/earendil-works/pi-coding-agent">pi coding agent</a> ecosystem</sub>
</p>
