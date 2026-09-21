# Table of contents (`/toc`)

Jump the transcript to any of your earlier messages. Built for long sessions where scrolling back to find "that one prompt" is the slow part.

```
/toc
```

```
──────────────────────────────────────────────────────────────
  Table of Contents · 42 user messages
  Type to search:
──────────────────────────────────────────────────────────────

  #41  the login flow breaks on mobile
  #42  add a retry policy to the client for flaky calls
→ #43  port the loader from pi-droid-styling

  ↑↓ move · Enter jump · Escape/ctrl+c close
──────────────────────────────────────────────────────────────
```

The panel opens in place of the editor, full width, the same way pi's `/tree` does — no floating box over the transcript. The search row sits at the top under the title, and the key hints sit at the bottom, like pi's `/settings` panel.

| Key | Action |
|---|---|
| type | Filter by any part of the message text (not just the start) |
| `↑` `↓` | Move the selection (wraps at both ends) |
| `enter` | Scroll the transcript so that message is at the top, and close |
| `escape` | Close without jumping |
| `backspace` | Remove the last search character |

Mouse clicks work too — clicking an entry jumps to it.

## How it behaves

- The list shows **user messages only**, oldest to newest, with the newest selected when it opens. pi's `Ctrl+Up` / `Ctrl+Down` already step through every message start.
- Entry labels are the first non-empty line of the message, whitespace-collapsed and truncated.
- The list is capped at half the terminal height (same cap as pi's session tree) and shows a scroll counter when it overflows.
- After a jump, the transcript stops following the end of the session so you can read without being pulled back down. pi's own "↓ Jump to latest message" indicator appears on the bottom row.
- The list is rebuilt from the live transcript every time you run the command, so `/new`, `/tree` navigation, compaction and session resume are all reflected.

## Fullscreen requirement

Jumping to a message needs the **fullscreen** TUI (`tuiMode: "fullscreen"`, or **TUI mode** in `/settings`). In the default `regular` mode the terminal owns the scrollback, so pi has no scroll surface to move; `/toc` then reports that instead of doing nothing.

## Implementation notes

- The transcript is a `ScrollView` in fullscreen mode. `/toc` reads it through the TUI handle pi hands to extensions, and scrolls with `ScrollView.scrollTo(row)`.
- Row numbers are content line indices — the same unit pi uses for its own `Ctrl+Up` prompt jumps.
- Row offsets come from the heights of the sibling components above each message (pi's container render maps), not from a character count, so wrapped text, boxed blocks, tool badges and images all line up.
- The row is measured again right after the panel closes, so output that arrives while the list is open cannot misdirect the jump.
- User messages are found by a marker that pi-ui's user-message patch sets on the component prototype, with a constructor-name check as a fallback.

These touch pi internals (`getPrimaryScrollView`, `ScrollView.scrollTo`, `Container.mouseLayout`), which are not part of the documented extension API. Everything is feature-detected: if a future pi changes them, `/toc` reports that it cannot jump instead of breaking the session. See [porting notes](./porting-notes.md).
