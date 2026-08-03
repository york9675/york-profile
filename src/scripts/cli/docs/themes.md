# Themes and styling

[← Documentation table of contents](./cli-development.md)

## Table of Contents

- [Theme-aware styling](#theme-aware-styling)
- [Terminal variables](#terminal-variables)
- [Add a theme](#add-a-theme)
- [Validate a theme](#validate-a-theme)

## Theme-aware styling

All terminal and TUI styling lives in `src/styles/cli.css`. Use variables instead of fixed foreground and background colors:

```css
.terminal-demo-screen {
  color: var(--terminal-text);
  background: var(--terminal-bg);
  border-color: var(--terminal-muted);
}
```

Use the semantic variable closest to the content's purpose. Inverted selections and headers normally use an accent or bright background with `--terminal-bg` as their foreground.

The [runtime API reference](./runtime-api.md#available-tones) lists the TypeScript `Tone` names that correspond to these variables.

## Terminal variables

Every theme defines:

| Variable | Use |
| --- | --- |
| `--terminal-bg` | Page, terminal, TUI, and inverted-text background. |
| `--terminal-text` | Default foreground and normal white palette swatch. |
| `--terminal-bright` | High-emphasis foreground and bright white swatch. |
| `--terminal-muted` | Secondary text, scrollbars, and bright black swatch. |
| `--terminal-accent` | Primary accent, valid commands, and green swatch. |
| `--terminal-blue` | Blue tone, paths, selections, and blue swatch. |
| `--terminal-yellow` | Yellow tone and swatch. |
| `--terminal-red` | Error tone and red swatch. |
| `--terminal-magenta` | Magenta tone and swatch. |
| `--terminal-cyan` | Cyan tone and swatch. |
| `--terminal-palette-black` | Normal black palette swatch. |

## Add a theme

1. Add a stable lowercase identifier to `themes` in `src/scripts/cli/config.ts`.
2. Add its human-readable label and exact background color to `themeMetadata`. The `Record<CliTheme, ...>` type requires metadata for every registered identifier.
3. Add `:root[data-cli-theme="<identifier>"]` to `src/styles/cli.css`.
4. Define every variable in the table above. Do not inherit missing colors from the default theme.

Example:

```css
:root[data-cli-theme="example"] {
  --terminal-bg: #101418;
  --terminal-text: #dce4ec;
  --terminal-bright: #ffffff;
  --terminal-muted: #9aa8b5;
  --terminal-accent: #7ee787;
  --terminal-blue: #79c0ff;
  --terminal-yellow: #e3b341;
  --terminal-red: #ff7b72;
  --terminal-magenta: #d2a8ff;
  --terminal-cyan: #56d4dd;
  --terminal-palette-black: #252b32;
}
```

The shared registry automatically supplies settings selection, live preview, `theme --list`, validation, TypeScript's `CliTheme`, theme-name completion, persistence, fastfetch output, and browser theme-color synchronization.

## Validate a theme

Run the automated contract check:

```sh
pnpm verify:cli:themes
```

It verifies:

- every registered theme has a CSS block;
- CSS has no unregistered theme blocks;
- every required variable is present;
- normal text, accent, and muted text meet at least WCAG AA 4.5:1 contrast against the theme background.

Then manually check:

- settings previews without saving and restores the original theme on discard;
- `theme --list` marks the active theme;
- `theme <identifier>` persists locally;
- prompt, errors, links, selections, cursor, TUI headers, and editor selections remain readable;
- both `fastfetch` palette rows are complete and touch with no gap;
- browser theme color follows previews and saved changes.

[TUI development ←](./tui-apps.md) · [Release checklist →](./release-checklist.md)
