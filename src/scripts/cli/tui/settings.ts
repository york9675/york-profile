import {
  cliConfig,
  cursorStyles,
  defaultSettings,
  themeMetadata,
  themes,
  validation
} from '../config';
import type { CliTheme, CursorStyle } from '../config';
import type { SettingsTuiState } from '../types';
import { appendTuiLine } from './dom';

export interface SettingsSnapshot {
  username: string;
  computerName: string;
  theme: CliTheme;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  passwordOnRefresh: boolean;
  passwordEnabled: boolean;
}

export interface SettingsSaveRequest extends Omit<SettingsSnapshot, 'passwordEnabled'> {
  passwordAction: SettingsTuiState['passwordAction'];
  passwordDraft: string;
}

interface SettingsTuiOptions {
  root: HTMLElement;
  input: HTMLInputElement;
  version: string;
  getSnapshot: () => SettingsSnapshot;
  previewTheme: (theme: CliTheme) => void;
  save: (request: SettingsSaveRequest) => Promise<void>;
  requestDataReset: () => void;
  onClose: (saved: boolean) => void;
}

const item = {
  username: 0,
  computerName: 1,
  theme: 2,
  cursorStyle: 3,
  cursorBlink: 4,
  password: 5,
  passwordOnRefresh: 6,
  reset: 7,
  clearData: 8
} as const;
const itemCount = Object.keys(item).length;

function renderEditableValue(container: HTMLElement, value: string, cursor: number) {
  container.append(document.createTextNode(value.slice(0, cursor)));
  const cursorNode = document.createElement('span');
  cursorNode.className = 'terminal-settings-block-cursor';
  cursorNode.textContent = value[cursor] ?? ' ';
  container.append(cursorNode, document.createTextNode(value.slice(cursor + 1)));
}

export class SettingsTuiApp {
  private state: SettingsTuiState | null = null;
  private passwordEnabled = false;
  private saving = false;

  constructor(private readonly options: SettingsTuiOptions) {}

  open() {
    if (this.state) return;
    const snapshot = this.options.getSnapshot();
    const screen = document.createElement('section');
    screen.className = 'terminal-settings-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-label', `${cliConfig.name} settings`);
    this.saving = false;
    this.passwordEnabled = snapshot.passwordEnabled;
    this.state = {
      screen,
      selected: 0,
      editing: false,
      editCursor: 0,
      username: snapshot.username,
      computerName: snapshot.computerName,
      theme: snapshot.theme,
      originalTheme: snapshot.theme,
      cursorStyle: snapshot.cursorStyle,
      cursorBlink: snapshot.cursorBlink,
      passwordOnRefresh: snapshot.passwordOnRefresh,
      passwordAction: 'unchanged',
      passwordDraft: '',
      editOriginal: '',
      status: '',
      resetArmed: false
    };
    this.options.root.append(screen);
    this.render();
    this.options.input.focus({ preventScroll: true });
  }

  handleKey(event: KeyboardEvent) {
    if (!this.state) return false;
    event.preventDefault();
    if (this.saving) return true;
    const tui = this.state;

    if (tui.editing) {
      this.handleEditKey(event);
      this.render();
      return true;
    }

    if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
      tui.selected = Math.max(0, tui.selected - 1);
      tui.resetArmed = false;
    } else if (event.key === 'ArrowDown' || event.key === 'Tab') {
      tui.selected = Math.min(itemCount - 1, tui.selected + 1);
      tui.resetArmed = false;
    } else if (event.key === 'ArrowLeft') {
      this.cycle(-1);
    } else if (event.key === 'ArrowRight') {
      this.cycle(1);
    } else if (event.key === 'Enter') {
      this.activateSelected();
    } else if (event.key === 'Delete' && tui.selected === item.password) {
      tui.passwordAction = 'disable';
      tui.passwordDraft = '';
      tui.status = 'Password will be disabled when settings are saved.';
    } else if (event.key.toLowerCase() === 's') {
      void this.save();
      return true;
    } else if (event.key.toLowerCase() === 'q' || event.key === 'Escape') {
      this.close(false);
      return true;
    }
    this.render();
    return true;
  }

  private handleEditKey(event: KeyboardEvent) {
    if (!this.state) return;
    const tui = this.state;
    const passwordField = tui.selected === item.password;
    const field = tui.selected === item.username ? 'username' : 'computerName';
    const value = passwordField ? tui.passwordDraft : tui[field];
    const setValue = (nextValue: string) => {
      if (passwordField) tui.passwordDraft = nextValue;
      else tui[field] = nextValue;
    };

    if (event.key === 'Enter') {
      if (passwordField && !value) {
        tui.status = 'Password cannot be empty. Press Esc to discard.';
      } else {
        if (passwordField) tui.passwordAction = 'set';
        tui.editing = false;
        tui.status = '';
      }
    } else if (event.key === 'Escape') {
      setValue(tui.editOriginal);
      tui.editing = false;
      tui.status = '';
    } else if (event.key === 'ArrowLeft') {
      tui.editCursor = Math.max(0, tui.editCursor - 1);
    } else if (event.key === 'ArrowRight') {
      tui.editCursor = Math.min(value.length, tui.editCursor + 1);
    } else if (event.key === 'Home') {
      tui.editCursor = 0;
    } else if (event.key === 'End') {
      tui.editCursor = value.length;
    } else if (event.key === 'Backspace' && tui.editCursor > 0) {
      setValue(value.slice(0, tui.editCursor - 1) + value.slice(tui.editCursor));
      tui.editCursor -= 1;
    } else if (event.key === 'Delete') {
      setValue(value.slice(0, tui.editCursor) + value.slice(tui.editCursor + 1));
    } else if (
      event.key.length === 1
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && value.length < (passwordField ? 64 : 24)
    ) {
      setValue(value.slice(0, tui.editCursor) + event.key + value.slice(tui.editCursor));
      tui.editCursor += 1;
    }
  }

  private activateSelected() {
    if (!this.state) return;
    const tui = this.state;
    if (tui.selected <= item.computerName || tui.selected === item.password) {
      tui.editing = true;
      const currentValue = tui.selected === item.username
        ? tui.username
        : tui.selected === item.computerName
          ? tui.computerName
          : tui.passwordDraft;
      tui.editOriginal = currentValue;
      if (tui.selected === item.password) tui.passwordDraft = '';
      tui.editCursor = tui.selected === item.password ? 0 : currentValue.length;
      tui.status = '';
    } else if (tui.selected === item.clearData) {
      this.close(false);
      this.options.requestDataReset();
      return;
    } else if (tui.selected === item.reset) {
      if (tui.resetArmed) this.resetDraft();
      else {
        tui.resetArmed = true;
        tui.status = 'Press Enter again to load defaults. Changes are not saved yet.';
      }
    } else {
      this.cycle(1);
    }
  }

  private cycle(direction: -1 | 1) {
    if (!this.state) return;
    const tui = this.state;
    if (tui.selected === item.theme) {
      const index = themes.indexOf(tui.theme);
      tui.theme = themes[(index + direction + themes.length) % themes.length];
      this.options.previewTheme(tui.theme);
    } else if (tui.selected === item.cursorStyle) {
      const index = cursorStyles.indexOf(tui.cursorStyle);
      tui.cursorStyle = cursorStyles[(index + direction + cursorStyles.length) % cursorStyles.length];
    } else if (tui.selected === item.cursorBlink) {
      tui.cursorBlink = !tui.cursorBlink;
    } else if (tui.selected === item.passwordOnRefresh) {
      tui.passwordOnRefresh = !tui.passwordOnRefresh;
    }
  }

  private resetDraft() {
    if (!this.state) return;
    Object.assign(this.state, {
      username: defaultSettings.username,
      computerName: defaultSettings.computerName,
      theme: defaultSettings.theme,
      cursorStyle: defaultSettings.cursorStyle,
      cursorBlink: defaultSettings.cursorBlink,
      passwordOnRefresh: defaultSettings.passwordOnRefresh,
      passwordAction: 'disable',
      passwordDraft: '',
      resetArmed: false,
      status: 'Defaults loaded. Press S to save or Q to discard.'
    });
    this.options.previewTheme(this.state.theme);
  }

  private async save() {
    if (!this.state || this.saving) return;
    const tui = this.state;
    if (!validation.username.test(tui.username)) {
      tui.status = 'Invalid user name: use 1–24 safe characters and start with a letter.';
      tui.selected = item.username;
      this.render();
      return;
    }
    if (!validation.computerName.test(tui.computerName)) {
      tui.status = 'Invalid computer name: use 1–24 letters, numbers, dots, or hyphens.';
      tui.selected = item.computerName;
      this.render();
      return;
    }
    this.saving = true;
    tui.status = 'Saving...';
    this.render();
    try {
      await this.options.save({
        username: tui.username,
        computerName: tui.computerName,
        theme: tui.theme,
        cursorStyle: tui.cursorStyle,
        cursorBlink: tui.cursorBlink,
        passwordOnRefresh: tui.passwordOnRefresh,
        passwordAction: tui.passwordAction,
        passwordDraft: tui.passwordDraft
      });
      this.saving = false;
      if (this.state === tui) this.close(true);
    } catch {
      this.saving = false;
      if (this.state === tui) {
        tui.status = 'Unable to save settings. Press S to retry or Q to discard.';
        this.render();
      }
    }
  }

  private close(saved: boolean) {
    if (!this.state) return;
    if (!saved) this.options.previewTheme(this.state.originalTheme);
    this.state.screen.remove();
    this.state = null;
    this.options.onClose(saved);
  }

  private render() {
    if (!this.state) return;
    const tui = this.state;
    tui.screen.replaceChildren();
    appendTuiLine(tui.screen, `${cliConfig.name} ${this.options.version}`, 'terminal-settings-title');
    appendTuiLine(tui.screen, 'SETTINGS');
    appendTuiLine(tui.screen, '────────────────────────────────────────');
    appendTuiLine(tui.screen);

    const values = [
      tui.username,
      tui.computerName,
      `${themeMetadata[tui.theme].label} (${tui.theme})`,
      tui.cursorStyle === 'bar' ? '|' : tui.cursorStyle === 'underscore' ? '_' : 'block',
      tui.cursorBlink ? 'enabled' : 'disabled',
      tui.passwordAction === 'disable'
        ? 'will be disabled'
        : tui.passwordAction === 'set'
          ? 'new password configured'
          : this.passwordEnabled
            ? 'enabled'
            : 'disabled',
      tui.passwordOnRefresh ? 'enabled' : 'disabled',
      'press Enter',
      'type confirmation required'
    ];
    const labels = [
      'User name',
      'Computer name',
      'Color theme',
      'Cursor style',
      'Cursor blink',
      'Password',
      'Password on refresh',
      'Reset to defaults',
      'Clear all data'
    ];

    labels.forEach((label, index) => {
      const selected = tui.selected === index;
      const line = appendTuiLine(tui.screen, '', selected ? 'is-selected' : undefined);
      line.append(document.createTextNode(`${selected ? '>' : ' '} ${label.padEnd(22)} `));
      if (selected && tui.editing && index === item.password) {
        line.append(document.createTextNode('⚿'));
      } else if (selected && tui.editing && index <= item.computerName) {
        renderEditableValue(line, values[index], tui.editCursor);
      } else {
        line.append(document.createTextNode(values[index]));
      }
    });

    appendTuiLine(tui.screen);
    appendTuiLine(tui.screen, 'Theme preview', 'terminal-muted');
    const promptPreview = appendTuiLine(tui.screen);
    const previewSegments: Array<[string, string?]> = [
      [`${tui.username}@${tui.computerName}`, 'terminal-accent terminal-bold'],
      [':', 'terminal-bright terminal-bold'],
      ['~ $ ', 'terminal-blue terminal-bold'],
      ['ls', 'terminal-command-valid'],
      [' -la']
    ];
    previewSegments.forEach(([text, className]) => {
      const segment = document.createElement('span');
      segment.textContent = text;
      if (className) segment.className = className;
      promptPreview.append(segment);
    });
    const tonePreview = appendTuiLine(tui.screen);
    const tones = ['muted', 'accent', 'blue', 'yellow', 'error', 'magenta', 'cyan', 'bright'] as const;
    tones.forEach((tone, index) => {
      const segment = document.createElement('span');
      segment.className = `terminal-${tone}`;
      segment.textContent = `${index ? ' ' : ''}${tone}`;
      tonePreview.append(segment);
    });

    appendTuiLine(tui.screen);
    appendTuiLine(tui.screen, '────────────────────────────────────────');
    if (tui.editing) {
      appendTuiLine(tui.screen, 'Enter · save field    Esc · discard changes', 'terminal-settings-keys');
    } else {
      appendTuiLine(tui.screen, 'Up/Down · select    Left/Right · change    Enter · edit/activate', 'terminal-settings-keys');
      appendTuiLine(tui.screen, 'S · save and exit    Q or Esc · exit without saving', 'terminal-settings-keys');
    }
    if (tui.status) appendTuiLine(tui.screen, tui.status, 'terminal-settings-status');
  }
}
