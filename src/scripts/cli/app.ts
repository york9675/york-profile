import {
  cliConfig,
  dataResetConfirmation,
  defaultSettings,
  isCursorStyle,
  isTheme,
  recoveryPasscode,
  themeMetadata,
  validation
} from './config';
import type { CliTheme, CursorStyle } from './config';
import {
  commandMap,
  commandNames,
  commands,
  type ArgumentCompletion,
  type CommandContext
} from './commands';
import { VirtualFileSystem } from './filesystem';
import { tokenize } from './parser';
import { clearCliStorage, loadCliState, saveCliState } from './storage';
import { isMobileDevice } from './system';
import { boldSegment, renderSegments, segment, TerminalView } from './terminal';
import { SettingsTuiApp } from './tui/settings';
import { ManTuiApp } from './tui/man';
import { NanoTuiApp } from './tui/nano';
import { TopTuiApp } from './tui/top';
import type {
  AppMetadata,
  CompletionSession,
  ConfirmationPrompt,
  PasswordPrompt
} from './types';

const root = document.querySelector<HTMLElement>('[data-cli-root]');
const terminalScreen = document.querySelector<HTMLElement>('[data-terminal-screen]');
const output = document.querySelector<HTMLElement>('[data-terminal-output]');
const input = document.querySelector<HTMLInputElement>('[data-terminal-input]');
const inputRow = document.querySelector<HTMLElement>('[data-terminal-input-row]');
const promptElement = document.querySelector<HTMLElement>('[data-terminal-prompt]');
const inputHighlight = document.querySelector<HTMLElement>('[data-terminal-input-highlight]');
const cursorElement = document.querySelector<HTMLElement>('[data-terminal-cursor]');
const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

if (root && terminalScreen && output && input && inputRow && promptElement && inputHighlight && cursorElement) {
  const fileSystem = new VirtualFileSystem(defaultSettings.username);
  let username: string = defaultSettings.username;
  let computerName: string = defaultSettings.computerName;
  let cursorStyle: CursorStyle = defaultSettings.cursorStyle;
  let cursorBlink: boolean = defaultSettings.cursorBlink;
  let passwordHash: string | null = null;
  let passwordOnRefresh: boolean = defaultSettings.passwordOnRefresh;
  let sessionStarted = false;
  let loginFailureCount = 0;
  let historyIndex = 0;
  let historyDraft = '';
  let reverseSearchIndex = -1;
  let completionSession: CompletionSession | null = null;
  let passwordPrompt: PasswordPrompt | null = null;
  let confirmationPrompt: ConfirmationPrompt | null = null;
  const commandHistory: string[] = [];
  const appMetadata: AppMetadata = {
    version: root.dataset.appVersion ?? 'unknown',
    environment: root.dataset.appEnvironment ?? 'unknown',
    astro: root.dataset.astroVersion ?? 'unknown',
    preact: root.dataset.preactVersion ?? 'unknown',
    typescript: root.dataset.typescriptVersion ?? 'unknown',
    packageCount: Number.parseInt(root.dataset.packageCount ?? '', 10) || 0
  };

  const terminal = new TerminalView({
    screen: terminalScreen,
    output,
    input,
    prompt: promptElement,
    highlight: inputHighlight,
    cursor: cursorElement
  }, fileSystem, () => Boolean(passwordPrompt), () => Boolean(confirmationPrompt), commandNames, (commandName, args): ArgumentCompletion => {
    const completion = commandMap.get(commandName)?.completion;
    if (!completion) return 'none';
    return typeof completion === 'function' ? completion(args) : completion;
  });
  const {
    acceptGhostCompletion,
    appendCommandLine,
    appendLine,
    appendSegments,
    getCompletion,
    scrollToBottom,
    updateInput: updateInputPresentation
  } = terminal;

  function currentTheme(): CliTheme {
    const theme = document.documentElement.dataset.cliTheme;
    return theme && isTheme(theme) ? theme : defaultSettings.theme;
  }

  function applyTheme(theme: CliTheme) {
    if (theme === defaultSettings.theme) delete document.documentElement.dataset.cliTheme;
    else document.documentElement.dataset.cliTheme = theme;
    themeColorMeta?.setAttribute('content', themeMetadata[theme].background);
  }

  function applyCursorSettings() {
    cursorElement.dataset.style = cursorStyle;
    cursorElement.classList.toggle('is-blinking', cursorBlink);
  }

  function persistState() {
    try {
      saveCliState({
        username,
        computerName,
        theme: currentTheme(),
        cursorStyle,
        cursorBlink,
        passwordHash,
        passwordOnRefresh,
        history: commandHistory,
        filesystem: fileSystem.snapshot()
      });
    } catch { /* Storage may be unavailable. */ }
  }

  function displayPath(path = fileSystem.currentPath) {
    if (path === fileSystem.homePath) return '~';
    if (path.startsWith(`${fileSystem.homePath}/`)) return `~${path.slice(fileSystem.homePath.length)}`;
    return path;
  }

  function updatePrompt() {
    if (passwordPrompt) {
      promptElement.textContent = passwordPrompt.mode === 'new'
        ? 'New password: '
        : passwordPrompt.mode === 'confirm'
          ? 'Confirm password: '
          : 'Password: ';
      return;
    }
    if (confirmationPrompt) {
      promptElement.textContent = confirmationPrompt.message;
      return;
    }
    renderSegments(promptElement, [
      boldSegment(`${username}@${computerName}`, 'accent'),
      boldSegment(':', 'bright'),
      boldSegment(`${displayPath()} $ `, 'blue')
    ]);
  }

  async function hashPassword(value: string) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function beginPasswordPrompt(mode: PasswordPrompt['mode'], onVerified?: () => void) {
    passwordPrompt = { mode, onVerified };
    input.value = '';
    updatePrompt();
    updateInputPresentation();
    input.focus({ preventScroll: true });
  }

  function endPasswordPrompt() {
    passwordPrompt = null;
    input.value = '';
    updatePrompt();
    updateInputPresentation();
    input.focus({ preventScroll: true });
  }

  async function submitPasswordPrompt() {
    if (!passwordPrompt) return;
    const prompt = passwordPrompt;
    const value = input.value;
    appendLine(`${promptElement.textContent}⚿`, { command: true });

    if (prompt.mode === 'new') {
      if (!value) {
        appendLine('passwd: password cannot be empty', { tone: 'error' });
        endPasswordPrompt();
        return;
      }
      passwordPrompt = { mode: 'confirm', firstValue: value };
      input.value = '';
      updatePrompt();
      updateInputPresentation();
      return;
    }

    if (prompt.mode === 'confirm') {
      if (value !== prompt.firstValue) {
        appendLine('passwd: passwords do not match', { tone: 'error' });
        endPasswordPrompt();
        return;
      }
      passwordHash = await hashPassword(value);
      persistState();
      endPasswordPrompt();
      appendLine('password updated', { tone: 'muted' });
      return;
    }

    if (prompt.mode === 'login' && loginFailureCount >= 3 && value === recoveryPasscode) {
      passwordHash = null;
      loginFailureCount = 0;
      persistState();
      endPasswordPrompt();
      appendLine('Recovery passcode accepted. Password disabled.', { tone: 'yellow' });
      enterSession();
      return;
    }

    const valid = Boolean(passwordHash) && await hashPassword(value) === passwordHash;
    const onVerified = prompt.onVerified;
    if (!valid) {
      appendLine('Authentication failed.', { tone: 'error' });
      if (prompt.mode === 'login') {
        loginFailureCount += 1;
        if (loginFailureCount === 3) {
          appendLine(`Recovery available: enter '${recoveryPasscode}' to bypass login and disable the password.`, { tone: 'yellow' });
        }
        input.value = '';
        updatePrompt();
        updateInputPresentation();
        input.focus({ preventScroll: true });
      } else {
        endPasswordPrompt();
      }
      return;
    }
    loginFailureCount = 0;
    endPasswordPrompt();
    if (prompt.mode === 'login') {
      enterSession();
      return;
    }
    onVerified?.();
  }

  function beginConfirmationPrompt(message: string, expected: string, onConfirm: () => void) {
    confirmationPrompt = { message, expected, onConfirm };
    input.value = '';
    updatePrompt();
    updateInputPresentation();
    input.focus({ preventScroll: true });
  }

  function endConfirmationPrompt() {
    confirmationPrompt = null;
    input.value = '';
    updatePrompt();
    updateInputPresentation();
    input.focus({ preventScroll: true });
  }

  function submitConfirmationPrompt() {
    if (!confirmationPrompt) return;
    const prompt = confirmationPrompt;
    const value = input.value;
    appendLine(`${prompt.message}${value}`, { command: true });
    endConfirmationPrompt();
    if (value !== prompt.expected) {
      appendLine('Confirmation did not match. No data was cleared.', { tone: 'error' });
      scrollToBottom();
      return;
    }
    prompt.onConfirm();
  }

  function requirePassword(action: () => void) {
    if (!passwordHash) action();
    else beginPasswordPrompt('verify', action);
  }

  function exitTerminal() {
    inputRow.remove();
    appendLine('logout');
    scrollToBottom();
    window.setTimeout(() => { window.location.href = cliConfig.homeRoute; }, 120);
  }

  function logoutSession() {
    appendLine('logout');
    if (passwordHash) {
      sessionStarted = false;
      beginPasswordPrompt('login');
    } else {
      window.setTimeout(() => { window.location.href = cliConfig.homeRoute; }, 120);
    }
  }

  function configurePassword(args: string[]) {
    if (args.includes('--disable')) {
      passwordHash = null;
      persistState();
      appendLine('password disabled', { tone: 'muted' });
      return;
    }
    beginPasswordPrompt('new');
  }

  function clearAllData() {
    try {
      clearCliStorage();
    } catch { /* Storage may be unavailable. */ }
    username = defaultSettings.username;
    computerName = defaultSettings.computerName;
    cursorStyle = defaultSettings.cursorStyle;
    cursorBlink = defaultSettings.cursorBlink;
    passwordHash = null;
    passwordOnRefresh = defaultSettings.passwordOnRefresh;
    loginFailureCount = 0;
    commandHistory.splice(0);
    historyIndex = 0;
    historyDraft = '';
    reverseSearchIndex = -1;
    completionSession = null;
    fileSystem.reset(username);
    applyTheme(defaultSettings.theme);
    applyCursorSettings();
    terminal.clearOutput();
    appendLine('All terminal data has been cleared.', { tone: 'accent' });
    updatePrompt();
    updateInputPresentation();
    input.focus({ preventScroll: true });
    scrollToBottom();
  }

  function requestDataReset() {
    appendLine('Warning: this permanently clears settings, history, passwords, and user-created files.', { tone: 'yellow' });
    beginConfirmationPrompt(
      `Type '${dataResetConfirmation}' to clear all terminal data: `,
      dataResetConfirmation,
      clearAllData
    );
  }

  function enterSession() {
    if (!sessionStarted) {
      appendLine(`Welcome! Type 'help' to list all commands.`, { tone: 'muted' });
      appendLine();
      appendLine(`Last login: ${new Date().toLocaleString()} from ${window.location.hostname || 'localhost'}`);
      sessionStarted = true;
    }
    passwordPrompt = null;
    updatePrompt();
    updateInputPresentation();
    input.focus({ preventScroll: true });
    scrollToBottom();
  }

  const settingsTuiApp = new SettingsTuiApp({
    root,
    input,
    version: appMetadata.version,
    getSnapshot: () => ({
      username,
      computerName,
      theme: currentTheme(),
      cursorStyle,
      cursorBlink,
      passwordOnRefresh,
      passwordEnabled: Boolean(passwordHash)
    }),
    previewTheme: applyTheme,
    save: async settings => {
      let nextPasswordHash = passwordHash;
      if (settings.passwordAction === 'set') nextPasswordHash = await hashPassword(settings.passwordDraft);
      else if (settings.passwordAction === 'disable') nextPasswordHash = null;

      fileSystem.migrateHome(settings.username);
      username = settings.username;
      computerName = settings.computerName;
      cursorStyle = settings.cursorStyle;
      cursorBlink = settings.cursorBlink;
      passwordOnRefresh = settings.passwordOnRefresh;
      passwordHash = nextPasswordHash;
      applyTheme(settings.theme);
      applyCursorSettings();
      persistState();
    },
    requestDataReset,
    onClose: saved => {
      if (saved) appendLine('settings saved', { tone: 'muted' });
      updatePrompt();
      updateInputPresentation();
      input.focus({ preventScroll: true });
      scrollToBottom();
    }
  });

  const topTuiApp = new TopTuiApp({
    root,
    input,
    getUsername: () => username,
    appendLine,
    updateInput: updateInputPresentation,
    scrollToBottom
  });

  const manTuiApp = new ManTuiApp({
    root,
    input,
    updateInput: updateInputPresentation,
    scrollTerminalToBottom: scrollToBottom
  });

  const nanoTuiApp = new NanoTuiApp({
    root,
    input,
    version: appMetadata.version,
    fileSystem,
    persist: persistState,
    onClose: () => {
      updatePrompt();
      updateInputPresentation();
      input.focus({ preventScroll: true });
      scrollToBottom();
    }
  });

  const commandContext: CommandContext = {
    terminal,
    fileSystem,
    metadata: appMetadata,
    history: commandHistory,
    commands,
    getSession: () => ({
      username,
      computerName,
      theme: currentTheme(),
      cursorStyle,
      cursorBlink,
      passwordEnabled: Boolean(passwordHash),
      passwordOnRefresh
    }),
    updateSession: patch => {
      if (patch.username !== undefined) username = patch.username;
      if (patch.computerName !== undefined) computerName = patch.computerName;
      if (patch.cursorStyle !== undefined) cursorStyle = patch.cursorStyle;
      if (patch.cursorBlink !== undefined) cursorBlink = patch.cursorBlink;
      if (patch.passwordOnRefresh !== undefined) passwordOnRefresh = patch.passwordOnRefresh;
    },
    persist: persistState,
    updatePrompt,
    applyTheme,
    requirePassword,
    exitTerminal,
    logoutSession,
    configurePassword,
    requestDataReset,
    openSettings: () => settingsTuiApp.open(),
    openTop: () => topTuiApp.open(),
    openEditor: file => nanoTuiApp.open(file),
    openManual: commandName => {
      if (!commandName) {
        appendLine('What manual page do you want?', { tone: 'error' });
        return;
      }
      const command = commandMap.get(commandName);
      if (!command) {
        appendLine(`No manual entry for ${commandName}`, { tone: 'error' });
        return;
      }
      manTuiApp.open(command);
    }
  };

  function runCommand(value: string): { pending?: Promise<void> } {
    const parsed = tokenize(value);
    if ('error' in parsed) {
      appendLine(parsed.error, { tone: 'error' });
      return {};
    }
    const { command: commandName, args } = parsed;
    if (!commandName) return {};
    const command = commandMap.get(commandName);
    if (!command) {
      appendLine(`${commandName}: command not found. Type 'help' for available commands.`, { tone: 'error' });
      return {};
    }
    if (args.includes('-h') || args.includes('--help')) {
      appendLine(`Usage: ${command.usage}`);
      return {};
    }
    const invalidOption = args.find(arg => arg.startsWith('-') && !command.isOptionAllowed?.(arg));
    if (invalidOption) {
      appendLine(`${commandName}: invalid option '${invalidOption}'`, { tone: 'error' });
      appendLine(`Try '${commandName} -h' for usage.`, { tone: 'muted' });
      return {};
    }
    try {
      const result = command.execute(commandContext, args);
      if (result instanceof Promise) {
        return {
          pending: result.then(() => undefined).catch(() => {
            appendLine(`${commandName}: command failed`, { tone: 'error' });
          })
        };
      }
    } catch {
      appendLine(`${commandName}: command failed`, { tone: 'error' });
    }
    return {};
  }

  function submitCommand() {
    const value = input.value;
    let pending: Promise<void> | undefined;
    appendCommandLine(value);
    if (value.trim()) {
      if (commandHistory.at(-1) !== value) commandHistory.push(value);
      persistState();
      pending = runCommand(value).pending;
    }
    input.value = '';
    completionSession = null;
    historyIndex = commandHistory.length;
    historyDraft = '';
    reverseSearchIndex = -1;
    updateInputPresentation();
    if (pending) {
      input.disabled = true;
      inputRow.classList.add('is-pending');
      terminalScreen.setAttribute('aria-busy', 'true');
      scrollToBottom();
      void pending.finally(() => {
        input.disabled = false;
        inputRow.classList.remove('is-pending');
        terminalScreen.removeAttribute('aria-busy');
        updateInputPresentation();
        input.focus({ preventScroll: true });
        scrollToBottom();
      });
      return;
    }
    scrollToBottom();
  }

  function setCursor(position: number) {
    input.setSelectionRange(position, position);
    updateInputPresentation();
  }

  function navigateHistory(direction: -1 | 1) {
    if (!commandHistory.length) return;
    if (historyIndex === commandHistory.length && direction === -1) historyDraft = input.value;
    historyIndex = Math.max(0, Math.min(commandHistory.length, historyIndex + direction));
    input.value = historyIndex === commandHistory.length ? historyDraft : commandHistory[historyIndex];
    setCursor(input.value.length);
  }

  function deleteWordBackward() {
    const cursor = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, cursor);
    const start = before.search(/(?:\s+|[^\s]+\s*)$/);
    const cutFrom = start < 0 ? 0 : start;
    input.value = input.value.slice(0, cutFrom) + input.value.slice(cursor);
    setCursor(cutFrom);
  }

  function moveByWord(direction: -1 | 1) {
    const cursor = input.selectionStart ?? input.value.length;
    if (direction === -1) {
      const prefix = input.value.slice(0, cursor);
      const match = prefix.match(/\S+\s*$/);
      setCursor(match ? cursor - match[0].length : 0);
    } else {
      const suffix = input.value.slice(cursor);
      const match = suffix.match(/^\s*\S+/);
      setCursor(match ? cursor + match[0].length : input.value.length);
    }
  }

  function completeInput() {
    if (!input.value.trim()) return;
    if (!completionSession) {
      const completion = getCompletion();
      if (!completion) return;
      completionSession = {
        prefix: input.value.slice(0, completion.start),
        suffix: input.value.slice(completion.end),
        candidates: completion.candidates,
        index: 0
      };
    } else {
      completionSession.index = (completionSession.index + 1) % completionSession.candidates.length;
    }

    const candidate = completionSession.candidates[completionSession.index];
    input.value = `${completionSession.prefix}${candidate}${completionSession.suffix}`;
    setCursor(completionSession.prefix.length + candidate.length);
  }

  function reverseSearch() {
    if (!commandHistory.length) return;
    const query = input.value;
    const start = reverseSearchIndex < 0 ? commandHistory.length - 1 : reverseSearchIndex - 1;
    for (let index = start; index >= 0; index -= 1) {
      if (!query || commandHistory[index].includes(query)) {
        reverseSearchIndex = index;
        input.value = commandHistory[index];
        setCursor(input.value.length);
        return;
      }
    }
  }

  input.addEventListener('keydown', event => {
    if (passwordPrompt) {
      if (event.key === 'Enter') {
        event.preventDefault();
        void submitPasswordPrompt();
      } else if (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c')) {
        event.preventDefault();
        if (passwordPrompt.mode === 'login') {
          input.value = '';
          updateInputPresentation();
        } else {
          endPasswordPrompt();
          appendLine('^C', { tone: 'muted' });
        }
      } else if (event.key === 'Tab' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
      }
      return;
    }
    if (confirmationPrompt) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitConfirmationPrompt();
      } else if (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c')) {
        event.preventDefault();
        endConfirmationPrompt();
        appendLine('Data reset cancelled.', { tone: 'muted' });
      } else if (event.key === 'Tab' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
      }
      return;
    }
    if (nanoTuiApp.handleKey(event)) return;
    if (manTuiApp.handleKey(event)) return;
    if (topTuiApp.handleKey(event)) return;
    if (settingsTuiApp.handleKey(event)) return;
    const control = event.ctrlKey && !event.altKey && !event.metaKey;
    const meta = event.metaKey || event.altKey;
    if (event.key !== 'Tab') completionSession = null;

    if (event.key === 'Enter') {
      event.preventDefault();
      submitCommand();
    } else if (event.key === 'ArrowUp' || (control && event.key.toLowerCase() === 'p')) {
      event.preventDefault();
      navigateHistory(-1);
    } else if (event.key === 'ArrowDown' || (control && event.key.toLowerCase() === 'n')) {
      event.preventDefault();
      navigateHistory(1);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      completeInput();
    } else if (!event.shiftKey && event.key === 'ArrowRight' && (input.selectionStart ?? 0) === input.value.length && acceptGhostCompletion()) {
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const cursor = input.selectionStart ?? input.value.length;
      setCursor(Math.max(0, Math.min(input.value.length, cursor + (event.key === 'ArrowLeft' ? -1 : 1))));
    } else if (control && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setCursor(0);
    } else if (control && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      setCursor(input.value.length);
    } else if (control && event.key.toLowerCase() === 'u') {
      event.preventDefault();
      const cursor = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(cursor);
      setCursor(0);
    } else if (control && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const cursor = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, cursor);
      updateInputPresentation();
    } else if (control && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      deleteWordBackward();
    } else if (control && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      output.replaceChildren();
    } else if (control && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      appendCommandLine(input.value, '^C');
      input.value = '';
      historyIndex = commandHistory.length;
      updateInputPresentation();
      scrollToBottom();
    } else if (control && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      if (!input.value) {
        exitTerminal();
      } else {
        const cursor = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, cursor) + input.value.slice(cursor + 1);
        setCursor(cursor);
      }
    } else if (control && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      reverseSearch();
    } else if (meta && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      moveByWord(-1);
    } else if (meta && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      moveByWord(1);
    }
  });

  input.addEventListener('input', () => {
    completionSession = null;
    updateInputPresentation();
  });

  input.addEventListener('beforeinput', event => {
    if (nanoTuiApp.handleBeforeInput(event)) input.value = '';
  });

  input.addEventListener('paste', event => {
    if (nanoTuiApp.handlePaste(event)) input.value = '';
  });

  input.addEventListener('scroll', updateInputPresentation);
  input.addEventListener('click', updateInputPresentation);
  input.addEventListener('keyup', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
      updateInputPresentation();
    }
  });

  let pointerStart: { x: number; y: number } | null = null;
  root.addEventListener('pointerdown', event => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });

  root.addEventListener('pointerup', event => {
    const start = pointerStart;
    pointerStart = null;
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (link || !start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5;
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!moved && (!selection || selection.isCollapsed)) input.focus({ preventScroll: true });
    });
  });

  root.addEventListener('pointercancel', () => {
    pointerStart = null;
  });

  try {
    const stored = loadCliState();
    if (stored.enabled) {
      if (stored.theme && isTheme(stored.theme)) applyTheme(stored.theme);
      if (stored.username && validation.username.test(stored.username)) username = stored.username;
      if (stored.computerName && validation.computerName.test(stored.computerName)) computerName = stored.computerName;
      if (stored.cursorStyle && isCursorStyle(stored.cursorStyle)) cursorStyle = stored.cursorStyle;
      cursorBlink = stored.cursorBlink === 'true';
      if (stored.passwordHash && validation.passwordHash.test(stored.passwordHash)) passwordHash = stored.passwordHash;
      passwordOnRefresh = stored.passwordOnRefresh !== 'false';
      if (Array.isArray(stored.history)) {
        commandHistory.push(...stored.history.filter(item => typeof item === 'string').slice(-cliConfig.historyLimit));
      }
      fileSystem.migrateHome(username);
      fileSystem.restore(stored.filesystem);
    } else {
      clearCliStorage();
    }
  } catch { /* Storage may be unavailable. */ }

  fileSystem.migrateHome(username);
  historyIndex = commandHistory.length;
  applyCursorSettings();
  appendSegments([segment(cliConfig.name), segment(` ${appMetadata.version}`)]);
  if (isMobileDevice()) {
    appendLine('Mobile device detected. Visit this page on a computer for a better terminal experience.', { tone: 'yellow' });
  }
  if (passwordHash && passwordOnRefresh) beginPasswordPrompt('login');
  else enterSession();
}
