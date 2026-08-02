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
  <a href="./docs/development.md"><img src="https://img.shields.io/badge/Dev_Guide-📖-89B4FA?style=flat-square"></a>
</p>

---

## 📋 Features

- 🖥️ **Custom Status Bar** — Real-time footer showing model, thinking level, cwd, git branch, context usage (%), and API cost
- 🎨 **Catppuccin Dark Theme** — Dark theme based on [Catppuccin Mocha](https://github.com/catppuccin/catppuccin) with 64+ color mappings
- ✨ **Boxed Editor** — Unicode border editor (`╭─╮` style) with elegant rounded corners
- ⏳ **Adaptive Working Indicator** — Animated spinner with 3-tone coloring (green→yellow→red) and real-time elapsed time
- 🌟 **Welcome Screen** — Custom startup header with pi banner and resource grid (Context, Skills, Prompts, Extensions)
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

Once installed, pi-ui works **automatically** — no configuration required. On session start the footer, editor, spinner, welcome screen, and message renderer are all registered.

### Status Bar

```
󰏿 | 󰚩 provider/model 󰧑 thinking_level  cwd  branch 󰨊 context% 󰇁 cost
```

### Editor

```
╭──────────────────────────────────────────╮
│  Your message here...                    │
╰──────────────────────────────────────────╯
```

### Working Indicator

Spinner (󰪞→󰪥) with adaptive color:

| Color | Condition |
|---|---|
| 🟢 Green | Token received < 10s ago |
| 🟡 Yellow | 10–30s since last token |
| 🔴 Red | > 30s — possible stall |

## 🎨 Themes

```
/theme catppuccin-dark
```

## 🏗️ Project Structure

```
pi-ui/
├── src/
│   ├── index.ts     # Extension entry
│   ├── ui.ts        # UI setup — footer, editor, spinner, message renderer
│   ├── footer.ts    # Footer rendering
│   ├── editor.ts    # BoxedEditor component
│   └── welcome.ts   # Welcome screen header and resource grid
├── themes/
│   └── catppuccin-dark.json
├── docs/
│   └── development.md  # Dev & publishing guide
└── .github/
    └── workflows/
        └── release.yml
```

## 🛠️ Development

See [docs/development.md](./docs/development.md) for the full development and publishing workflow.

## 🙏 Credits

This project is a fork of [DragonYH/pi-ui](https://github.com/DragonYH/pi-ui), originally published as [`@rokiy/pi-ui`](https://www.npmjs.com/package/@rokiy/pi-ui).

The welcome screen is ported from [pi-kaush/pi-welcome-screen](https://github.com/might-guy106/pi-kaush) by the same author.

## 📄 License

[MIT](./LICENSE)

---

<p align="center">
  <sub>Built for the <a href="https://github.com/earendil-works/pi-coding-agent">pi coding agent</a> ecosystem</sub>
</p>
