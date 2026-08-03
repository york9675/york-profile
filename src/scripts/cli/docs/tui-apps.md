# TUI application development

[← Documentation table of contents](./cli-development.md)

## Table of Contents

- [TUI contract](#tui-contract)
- [Class template](#class-template)
- [Integration](#integration)
- [Keyboard and text input](#keyboard-and-text-input)
- [Rendering and styling](#rendering-and-styling)
- [Lifecycle checklist](#lifecycle-checklist)

## TUI contract

A TUI is a fullscreen, text-only application inside the CLI root. Existing examples:

- `settings.ts` — selection, editing, preview, save, and discard behavior;
- `top.ts` — selection, details, pausing, and interval cleanup;
- `man.ts` — line/page scrolling and event-listener cleanup;
- `nano.ts` — cursor movement, selection, IME/text input, paste, mouse selection, prompts, and file persistence.

Use the whole page. Do not create a desktop-style graphical window or native form controls inside the terminal UI.

## Class template

```ts
import { appendTuiLine } from './dom';

interface DemoState {
  screen: HTMLElement;
  selected: number;
}

interface DemoOptions {
  root: HTMLElement;
  input: HTMLInputElement;
  updateInput: () => void;
  scrollToBottom: () => void;
}

export class DemoTuiApp {
  private state: DemoState | null = null;

  constructor(private readonly options: DemoOptions) {}

  open() {
    if (this.state) return;
    const screen = document.createElement('section');
    screen.className = 'terminal-demo-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-label', 'Demo application');
    this.state = { screen, selected: 0 };
    this.options.root.append(screen);
    this.render();
    this.options.input.focus({ preventScroll: true });
  }

  handleKey(event: KeyboardEvent) {
    if (!this.state) return false;
    event.preventDefault();
    const key = event.key.toLowerCase();

    if (key === 'q' || event.key === 'Escape' || (event.ctrlKey && key === 'c')) {
      this.close();
      return true;
    }
    if (event.key === 'ArrowUp') {
      this.state.selected = Math.max(0, this.state.selected - 1);
    } else if (event.key === 'ArrowDown') {
      this.state.selected = Math.min(4, this.state.selected + 1);
    }
    this.render();
    return true;
  }

  private render() {
    if (!this.state) return;
    this.state.screen.replaceChildren();
    appendTuiLine(this.state.screen, 'DEMO');
  }

  private close() {
    if (!this.state) return;
    this.state.screen.remove();
    this.state = null;
    this.options.updateInput();
    this.options.input.focus({ preventScroll: true });
    this.options.scrollToBottom();
  }
}
```

## Integration

1. Add the class under `src/scripts/cli/tui/`.
2. Keep private state types in the module; add them to `types.ts` only when another module consumes them.
3. Import and instantiate the app in `app.ts`.
4. Route `handleKey(event)` before normal shell keyboard handling.
5. Add a narrowly scoped `CommandContext` action if a command opens it.
6. Add a command module that calls that action.
7. Add fullscreen theme-aware styles to `src/styles/cli.css`.

The current routing order is authentication, nano, manual pager, task monitor, settings, then the normal shell. Place a new app according to its input priority and document any changed order.

## Keyboard and text input

`handleKey()` must return `false` while closed and consume events while open. Clamp menu selection at the first and last rows unless wrapping is explicitly intended.

Support:

- Arrow keys for the primary interaction.
- `Q`, Escape, and preferably Ctrl+C for quitting.
- Familiar alternatives such as J/K when they fit the app.
- Home/End and Page Up/Down for scrollable documents.

An editor cannot rely on `keydown` alone. Printable text, mobile input, composed characters, and paste need `beforeinput` and `paste` routing. Follow `nano.ts` when building editable text rather than inventing a second partial editor model.

If pointer input is supported, distinguish clicks from selection drags. Do not globally steal focus in a way that prevents terminal or TUI text selection.

## Rendering and styling

Use `appendTuiLine(container, text, className?)` from `tui/dom.ts` for safe text rows. Use `textContent` and `createTextNode` for richer rows; never inject user or remote content as HTML.

Every screen must:

- cover the viewport with `position: fixed` and `inset: 0`;
- use `--terminal-*` theme variables;
- inherit the monospace font;
- avoid outer page padding;
- remain usable on narrow screens and with overflowing preformatted content;
- expose `role="dialog"` and a useful `aria-label`.

See [themes and styling](./themes.md) for every CSS variable.

## Lifecycle checklist

- Reopening an already open app does not duplicate it.
- Selection does not wrap unexpectedly.
- Escape/Q/Ctrl+C behavior is intentional.
- Save and discard paths are distinct where editing occurs.
- All intervals are cleared in `close()`.
- All element/document/window listeners added by the app are removed in `close()`.
- The hidden command input regains focus after close.
- Terminal input presentation and scroll position are restored.
- Text remains selectable with pointer input.
- The app renders correctly under every theme.

[Runtime API reference ←](./runtime-api.md) · [Themes and styling →](./themes.md)
