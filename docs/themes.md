# Themes

## Bundled

- `catppuccin-dark` — Catppuccin Mocha (`/theme catppuccin-dark`).

pi-ui's editor zone works with any active pi theme: it reads theme tokens (`accent`, `muted`, `border`, `selectedBg`, `success`, `warning`, `error`, …) through the theme API, so the zone recolors itself when you switch themes.

## Theme extras

Some fine-grained colors (prompt color, slash-menu colors, input border) are read as `extras` from the active theme's JSON file on disk, with sensible fallbacks when absent:

| Extra key | Used for | Fallback |
|---|---|---|
| `userPrefixColor` | `❯` prompt in the gemini/droid styles | `accent` |
| `bashPromptColor` | `›` prompt in the cli-dock style and bash-mode accents | preset color |
| `inputBorderColor` | outline/line input frames, slash-menu border | preset border color |
| `slashCommandColor` | slash-menu command column | accent |
| `slashDescriptionColor` | slash-menu description column | dim |
| `slashSelectedColor` | highlighted slash-menu row | accent |
| `slashHintColor` | slash-menu navigation hint | dim |

Extras are resolved from the theme file found via `theme.sourcePath`; if the theme has no `extras` block every key falls back.

## Planned

- Additional bundled themes (port of the upstream pi-themes companion collection) — see the [port plan](./plans/pi-droid-styling-port-plan.md).
- OSC 11 terminal background sync so the terminal chrome matches the theme background.
