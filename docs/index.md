# pi-ui Documentation

Custom terminal UI for the [pi coding agent](https://github.com/earendil-works/pi-coding-agent): a styled editor zone, themed startup, a state-aware working loader, and (in progress) tool badges, message prefixes, and side-by-side diffs — ported from [sting8k/pi-droid-styling](https://github.com/sting8k/pi-droid-styling).

## Start here

| Page | What it covers |
|---|---|
| [README](../README.md) | What the package is, install, quick look-and-feel tour |
| [Configuration](./configuration.md) | Every config key in `~/.pi/agent/pi-ui.json`, defaults, examples |
| [Editor styles](./editor-styles.md) | The 4 user-zone styles (`droid`, `gemini`, `cli-dock`, `nvim`) and input frames, with previews |
| [Tools](./tools.md) | Tool badges, split diff, presentation styles (`droid`/`reasonix`) |

## Use

| Page | What it covers |
|---|---|
| [Themes](./themes.md) | Bundled themes, how theme extras work |
| [Working loader](./loader.md) | Spinner states, adaptive tones, custom labels |
| [Startup](./startup.md) | Gradient pi logo, key hints, terminal background sync (OSC 11) |
| [Messages](./messages.md) | Assistant/user prefixes, thinking tail, boxed blocks, codeblock rail |
| [Tools](./tools.md) | Tool badges, split diff, presentation styles |

## Develop

| Page | What it covers |
|---|---|
| [Development](./development.md) | Local setup, running tests, publishing a release |
| [Architecture](./architecture.md) | Module map, how the editor/footer/loader hook into pi, lifecycle |
| [Porting notes](./porting-notes.md) | What was ported from pi-droid-styling, version caveats, credits |

## Plans and decisions

| Page | What it covers |
|---|---|
| [pi-droid-styling port plan](./plans/pi-droid-styling-port-plan.md) | Research, decision record, and phase plan for the port |
