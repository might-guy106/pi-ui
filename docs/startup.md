# Startup

What you see when a pi session starts, and how pi-ui keeps the terminal in sync with the theme. Ported from pi-droid-styling (see [porting notes](./porting-notes.md)).

## Gradient pi logo

The welcome header is topped by a 9-row block-ASCII "pi" logo with a truecolor gradient derived from your theme's accent color — a cosine wave that alternately darkens and lightens the accent across 24 steps, sampled per character with a per-row phase shift. In 256-color mode the gradient quantizes automatically.

Below the logo: `Pi v<version>`, the key hints (`/` commands · `!` bash · `ctrl+o` more), and a green `● ready`.

On narrower terminals the details drop under the logo; below ~20 columns a small static banner takes over so the logo never clips mid-glyph. The resource grid (Context / Skills / Prompts / Extensions) renders beneath the logo block — see [the README tour](../README.md).

## Cleaner startup

pi's `Model scope: … (Ctrl+P to cycle)` console line is filtered out at startup so the header is the first thing you see. The filter is symbol-marked and installs once.

## Terminal background sync (OSC 11)

On session start pi-ui sets the terminal emulator's own background to the theme's page background (`export.pageBg`, e.g. `#11111b` for catppuccin-dark) via the OSC 11 escape sequence. This covers the terminal-owned padding around pi's rendered area so the whole window matches the theme.

- On exit (or theme change) the original background is restored with OSC 111.
- Windows, WSL, and Windows Terminal are skipped (their OSC 11 handling is unreliable) unless `"forceOSC11": true` in [config](./configuration.md).
- The application restart re-applies the sync with the new theme when you switch themes.

If the theme has no hex page background defined, the sync is a no-op.
