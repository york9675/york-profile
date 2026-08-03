# CLI release checklist

[← Documentation table of contents](./cli-development.md)

## Table of Contents

- [Automated release gate](#automated-release-gate)
- [Command behavior](#command-behavior)
- [Terminal interaction](#terminal-interaction)
- [TUI applications](#tui-applications)
- [Persistence and authentication](#persistence-and-authentication)
- [Accessibility and safety](#accessibility-and-safety)
- [Pull-request preparation](#pull-request-preparation)

## Automated release gate

Use pnpm and run:

```sh
pnpm verify:cli
```

This runs theme contract verification, Astro diagnostics, ESLint, and the production build. Expected results:

- all registered themes are complete and pass contrast checks;
- Astro reports zero errors, warnings, and hints;
- ESLint reports no errors;
- every static route, including `/cli`, builds successfully.

Use `git diff --check` to catch whitespace errors before committing.

## Command behavior

- `help` lists every registered command with aligned descriptions.
- Every command supports `-h` and `--help` through the central handler.
- `man <command>` opens a complete manual and exits cleanly.
- Invalid options report an invalid-option error instead of becoming operands.
- Missing, extra, and invalid operands use understandable Unix-style messages.
- Completion suggests only valid operand categories and does nothing when inappropriate.
- Async commands show loading feedback and do not show a prompt before completion.
- `exit` prints only logout and returns home without authentication or an extra prompt.
- `sudo rm -rf /` opens typed confirmation and clears nothing when confirmation does not match.

## Terminal interaction

- Up/Down and Ctrl+P/Ctrl+N navigate history.
- Ctrl+A/E, Ctrl+U/K/W, Ctrl+L/C/D/R, and Alt/Option+B/F behave as documented by the shell.
- Tab cycles completions; empty input does not cycle commands.
- Right Arrow accepts ghost completion only at the end and without Shift.
- Holding Left/Right moves the cursor continuously.
- Shift+Arrow does not create a selection in the command prompt.
- Clicking empty terminal space focuses input without breaking text selection or selection drags.
- The block cursor occupies one character, highlights text beneath it, and follows configured style/blink settings.

## TUI applications

- Selection clamps at the first and last row unless wrapping is explicitly designed.
- Escape/Q/Ctrl+C behavior is consistent and does not leak keystrokes to the shell.
- Save and discard behavior is distinct.
- Fullscreen screens have no desktop-window chrome or native form controls.
- Closing restores focus, input presentation, and terminal scroll.
- Intervals and event listeners are cleaned up.
- Nano supports unnamed buffers, selection, editing, paste, save-as, overwrite confirmation, and clean exit.
- Man scrolls by terminal line/page rather than browser smooth scrolling.

## Persistence and authentication

- Settings, command history, modification dates, and user-created virtual files survive refresh.
- Clearing data resets settings, history, passwords, and user-created filesystem entries.
- Bundled content remains readable but cannot be edited, touched, moved, or removed; the home workspace accepts new writable entries.
- Username changes migrate `/home/<user>` and update the prompt and `.profile`.
- Password input always displays one key glyph, never typed characters or a cursor.
- Authentication failure does not expose a usable command prompt.
- Password-on-refresh follows its setting.
- Recovery appears after three failed attempts and disables the forgotten password only with the recovery passcode.
- Sensitive commands use the shared password flow instead of implementing their own.

## Accessibility and safety

- Terminal output and TUI content use text nodes rather than `innerHTML`.
- Remote responses are checked and validated before rendering.
- External links use safe new-tab behavior.
- Every fullscreen TUI has `role="dialog"` and an accurate `aria-label`.
- Terminal output remains selectable with a pointer.
- Themes keep normal, accent, and muted text at accessible contrast.
- The virtual filesystem never reads or writes the visitor's real filesystem.
- No password hash, secret, or sensitive stored value is printed.

## Pull-request preparation

- Keep the change focused and preserve unrelated work in the tree.
- Update the relevant focused documentation when an API or behavior changes.
- Include manual test notes for keyboard, persistence, or TUI changes.
- Include the `pnpm verify:cli` result in the pull-request description.
- Open the repository and pull-request links from the in-terminal `sdk` command.

[Themes and styling ←](./themes.md) · [Back to documentation hub](./cli-development.md)
