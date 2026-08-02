import {
  commandNames,
  commandUsage,
  defaultSettings,
  fortuneSource,
  recoveryPasscode,
  storageKeys,
  themes
} from './config';
import { VirtualFileSystem } from './filesystem';
import { tokenize } from './parser';
import { segment, TerminalView } from './terminal';
import { SettingsTuiApp } from './tui/settings';
import { TopTuiApp } from './tui/top';
import type {
  AppMetadata,
  CompletionSession,
  PasswordPrompt,
  Tone
} from './types';

const root = document.querySelector<HTMLElement>('[data-cli-root]');
const terminalScreen = document.querySelector<HTMLElement>('[data-terminal-screen]');
const output = document.querySelector<HTMLElement>('[data-terminal-output]');
const input = document.querySelector<HTMLInputElement>('[data-terminal-input]');
const inputRow = document.querySelector<HTMLElement>('[data-terminal-input-row]');
const promptElement = document.querySelector<HTMLElement>('[data-terminal-prompt]');
const inputHighlight = document.querySelector<HTMLElement>('[data-terminal-input-highlight]');
const cursorElement = document.querySelector<HTMLElement>('[data-terminal-cursor]');

if (root && terminalScreen && output && input && inputRow && promptElement && inputHighlight && cursorElement) {
  const fileSystem = new VirtualFileSystem(defaultSettings.username);
  const { directories, files } = fileSystem;
  let username: string = defaultSettings.username;
  let computerName: string = defaultSettings.computerName;
  let cursorStyle: string = defaultSettings.cursorStyle;
  let cursorBlink: boolean = defaultSettings.cursorBlink;
  let passwordHash: string | null = null;
  let passwordOnRefresh: boolean = defaultSettings.passwordOnRefresh;
  let sessionStarted = false;
  let loginFailureCount = 0;
  let storageEnabled: boolean = defaultSettings.storageEnabled;
  let historyIndex = 0;
  let historyDraft = '';
  let reverseSearchIndex = -1;
  let completionSession: CompletionSession | null = null;
  let passwordPrompt: PasswordPrompt | null = null;
  const commandHistory: string[] = [];
  const appMetadata: AppMetadata = {
    version: root.dataset.appVersion ?? 'unknown',
    environment: root.dataset.appEnvironment ?? 'unknown',
    astro: root.dataset.astroVersion ?? 'unknown',
    preact: root.dataset.preactVersion ?? 'unknown',
    typescript: root.dataset.typescriptVersion ?? 'unknown'
  };

  let fortuneCache: string[] | null = null;
  const terminal = new TerminalView({
    screen: terminalScreen,
    output,
    input,
    prompt: promptElement,
    highlight: inputHighlight,
    cursor: cursorElement
  }, fileSystem, () => Boolean(passwordPrompt));
  const {
    acceptGhostCompletion,
    appendCommandLine,
    appendLine,
    appendSegments,
    getCompletion,
    scrollToBottom,
    updateInput: updateInputPresentation
  } = terminal;

  function currentTheme() {
    return document.documentElement.dataset.cliTheme ?? 'green';
  }

  function applyTheme(theme: string) {
    if (theme === 'green') delete document.documentElement.dataset.cliTheme;
    else document.documentElement.dataset.cliTheme = theme;
  }

  function applyCursorSettings() {
    cursorElement.dataset.style = cursorStyle;
    cursorElement.classList.toggle('is-blinking', cursorBlink);
  }

  function persistState() {
    if (!storageEnabled) return;
    try {
      localStorage.setItem(storageKeys.enabled, 'true');
      localStorage.setItem(storageKeys.username, username);
      localStorage.setItem(storageKeys.computerName, computerName);
      localStorage.setItem(storageKeys.theme, currentTheme());
      localStorage.setItem(storageKeys.cursorStyle, cursorStyle);
      localStorage.setItem(storageKeys.cursorBlink, String(cursorBlink));
      localStorage.setItem(storageKeys.passwordOnRefresh, String(passwordOnRefresh));
      if (passwordHash) localStorage.setItem(storageKeys.passwordHash, passwordHash);
      else localStorage.removeItem(storageKeys.passwordHash);
      localStorage.setItem(storageKeys.history, JSON.stringify(commandHistory.slice(-100)));
      localStorage.setItem(storageKeys.filesystem, JSON.stringify(fileSystem.snapshot()));
    } catch { /* Storage may be unavailable. */ }
  }

  function updateStoragePreference(enabled: boolean) {
    storageEnabled = enabled;
    try {
      if (enabled) {
        persistState();
      } else {
        localStorage.removeItem(storageKeys.username);
        localStorage.removeItem(storageKeys.computerName);
        localStorage.removeItem(storageKeys.theme);
        localStorage.removeItem(storageKeys.cursorStyle);
        localStorage.removeItem(storageKeys.cursorBlink);
        localStorage.removeItem(storageKeys.passwordHash);
        localStorage.removeItem(storageKeys.passwordOnRefresh);
        localStorage.removeItem(storageKeys.history);
        localStorage.removeItem(storageKeys.filesystem);
        localStorage.setItem(storageKeys.enabled, 'false');
      }
    } catch { /* Storage may be unavailable. */ }
  }

  function printUsage(command: string) {
    appendLine(`Usage: ${commandUsage[command] ?? `${command} [-h]`}`);
  }

  function validateOptions(command: string, args: string[]) {
    const allowed = args.filter(arg => arg.startsWith('-')).every(arg => {
      if (command === 'ls') return /^-[al]+$/.test(arg);
      if (command === 'rm') return /^-[rRf]+$/.test(arg);
      if (command === 'uname') return arg === '-a';
      if (command === 'name') return arg === '--reset';
      if (command === 'passwd') return arg === '--disable';
      return false;
    });
    if (allowed) return true;
    const invalid = args.find(arg => arg.startsWith('-')) ?? '';
    appendLine(`${command}: invalid option '${invalid}'`, { tone: 'error' });
    appendLine(`Try '${command} -h' for usage.`, { tone: 'muted' });
    return false;
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
    promptElement.textContent = `${username}@${computerName}:${displayPath()}$ `;
  }

  function normalizePath(value = '.') {
    return fileSystem.normalize(value);
  }

  function printHelp() {
    appendSegments([
      segment('York Profile CLI commands', 'bright'),
      segment('  (arguments in '),
      segment('[brackets]', 'muted'),
      segment(' are optional)')
    ]);
    const entries = [
      ['about', 'a quick introduction'],
      ['cat <file>', 'read a file'],
      ['cd [path]', 'change directory'],
      ['clear', 'clear the terminal'],
      ['date', 'show the current date and time'],
      ['echo [text]', 'write text to the terminal'],
      ['env', 'show environment variables'],
      ['exit', 'return to the profile'],
      ['fastfetch', 'display profile, stack, and audio information'],
      ['fortune', 'fetch a Unix fortune'],
      ['help', 'list all available commands'],
      ['history', 'show command history'],
      ['hostname', 'show the computer name'],
      ['id', 'show user and group information'],
      ['logout', 'end the terminal session'],
      ['ls [path]', 'list a directory'],
      ['man <command>', 'show a command manual'],
      ['name [username]', 'inspect or change your username'],
      ['open <target>', 'open a profile alias or custom URL'],
      ['passwd [--disable]', 'set or disable the local password'],
      ['pwd', 'show the working directory'],
      ['rm [-r] <path>', 'remove files or directories'],
      ['settings', 'open terminal settings'],
      ['sudo <command>', 'try elevated privileges'],
      ['theme <name>', `switch between ${themes.length} terminal themes`],
      ['top', 'open the interactive task monitor'],
      ['touch <file>', 'create a file or update its timestamp'],
      ['uname [-a]', 'show CLI system information'],
      ['whoami', 'show the current username']
    ];
    for (const [name, description] of entries) {
      appendSegments([segment(`  ${name.padEnd(17)}`, 'accent'), segment(description)]);
    }
  }

  function listDirectory(args: string[]) {
    const showHidden = args.some(arg => arg.startsWith('-') && arg.includes('a'));
    const pathArg = args.find(arg => !arg.startsWith('-')) ?? '.';
    const path = normalizePath(pathArg);
    const entries = directories[path];
    if (!entries) {
      appendLine(`ls: cannot access '${pathArg}': No such directory`, { tone: 'error' });
      return;
    }
    const visible = showHidden ? ['.', '..', ...entries] : entries.filter(name => !name.startsWith('.'));
    appendSegments(visible.flatMap((name, index) => {
      const absolute = normalizePath(path === '/' ? `/${name}` : `${path}/${name}`);
      const tone: Tone | undefined = directories[absolute] ? 'blue' : name.startsWith('.') ? 'muted' : undefined;
      return [segment(name, tone), segment(index === visible.length - 1 ? '' : '  ')];
    }));
  }

  function readFiles(args: string[]) {
    if (!args.length) {
      appendLine('cat: missing file operand', { tone: 'error' });
      return;
    }
    for (const file of args) {
      const path = normalizePath(file);
      if (directories[path]) {
        appendLine(`cat: ${file}: Is a directory`, { tone: 'error' });
      } else if (!files[path]) {
        appendLine(`cat: ${file}: No such file or directory`, { tone: 'error' });
      } else {
        files[path].forEach(line => appendLine(line));
      }
    }
  }

  function pathParts(path: string) {
    const parts = path.split('/').filter(Boolean);
    return {
      name: parts.at(-1) ?? '',
      parent: parts.length <= 1 ? '/' : `/${parts.slice(0, -1).join('/')}`
    };
  }

  function touchFiles(args: string[]) {
    const targets = args.filter(arg => !arg.startsWith('-'));
    if (!targets.length) {
      appendLine('touch: missing file operand', { tone: 'error' });
      return;
    }
    for (const target of targets) {
      const path = normalizePath(target);
      const { name, parent } = pathParts(path);
      if (!name || !directories[parent]) {
        appendLine(`touch: cannot touch '${target}': No such file or directory`, { tone: 'error' });
      } else if (directories[path]) {
        appendLine(`touch: cannot touch '${target}': Is a directory`, { tone: 'error' });
      } else if (!files[path]) {
        files[path] = [];
        directories[parent].push(name);
      }
    }
    persistState();
  }

  function removeEntry(path: string, recursive: boolean, displayName: string) {
    if (
      path === '/'
      || path === fileSystem.homePath
      || path === fileSystem.currentPath
      || fileSystem.currentPath.startsWith(`${path}/`)
    ) {
      appendLine(`rm: cannot remove '${displayName}': Operation not permitted`, { tone: 'error' });
      return;
    }
    const { name, parent } = pathParts(path);
    if (files[path]) {
      delete files[path];
      directories[parent] = directories[parent]?.filter(entry => entry !== name) ?? [];
      return;
    }
    if (directories[path]) {
      if (!recursive) {
        appendLine(`rm: cannot remove '${displayName}': Is a directory`, { tone: 'error' });
        return;
      }
      for (const child of [...directories[path]]) {
        removeEntry(`${path}/${child}`, true, `${displayName}/${child}`);
      }
      delete directories[path];
      directories[parent] = directories[parent]?.filter(entry => entry !== name) ?? [];
      return;
    }
    appendLine(`rm: cannot remove '${displayName}': No such file or directory`, { tone: 'error' });
  }

  function removeFiles(args: string[]) {
    const recursive = args.some(arg => /^-[a-z]*r/.test(arg) || /^-[a-z]*R/.test(arg));
    const targets = args.filter(arg => !arg.startsWith('-'));
    if (!targets.length) {
      appendLine('rm: missing operand', { tone: 'error' });
      return;
    }
    targets.forEach(target => removeEntry(normalizePath(target), recursive, target));
    persistState();
  }

  function printFastfetch() {
    const art = [
      '__   __         _    ',
      '\\ \\ / /__  _ __| | __',
      ' \\ V / _ \\| \'__| |/ /',
      '  | | (_) | |  |   < ',
      '  |_|\\___/|_|  |_|\\_\\'
    ];
    const info: Array<[string, string] | [string]> = [
      [`${username}@${computerName}`],
      ['----------------'],
      ['OS', 'York Profile CLI'],
      ['Version', appMetadata.version],
      ['Host', computerName],
      ['Platform', navigator.platform || 'Web Browser'],
      ['Shell', 'yorksh'],
      ['Uptime', `${Math.max(1, Math.floor(performance.now() / 1000))} seconds`],
      ['Framework', `Astro v${appMetadata.astro}`],
      ['UI', `Preact v${appMetadata.preact}`],
      ['Language', `TypeScript v${appMetadata.typescript}`],
      ['Environment', appMetadata.environment],
      ['Source', 'github.com/york9675/york-profile'],
    ];
    const rows = Math.max(art.length, info.length);
    for (let index = 0; index < rows; index += 1) {
      const details = info[index];
      const isHeader = details?.length === 1 && Boolean(details[0]);
      appendSegments([
        segment((art[index] ?? '').padEnd(29), 'accent'),
        segment(details?.[0] ?? '', isHeader ? 'bright' : 'accent'),
        segment(details?.[1] ? ': ' : ''),
        segment(details?.[1] ?? '')
      ]);
    }
  }

  function openTarget(target?: string) {
    const targets: Record<string, string> = {
      home: '/',
      github: 'https://github.com/york9675',
      lastfm: 'https://www.last.fm/user/york0524',
      music: 'https://524-hz.bandcamp.com'
    };
    if (!target) {
      printUsage('open');
      return;
    }

    let destination = targets[target];
    if (!destination) {
      try {
        const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(target) ? target : `https://${target}`;
        const url = new URL(candidate);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol');
        destination = url.href;
      } catch {
        appendLine(`open: '${target}' is not a valid HTTP(S) URL or profile alias`, { tone: 'error' });
        return;
      }
    }

    appendSegments([segment('opening '), segment(destination, 'blue', destination)]);
    if (target === 'home') window.setTimeout(() => { window.location.href = '/'; }, 180);
    else window.open(destination, '_blank', 'noopener,noreferrer');
  }

  async function printFortune() {
    try {
      if (!fortuneCache) {
        const response = await fetch(fortuneSource);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        fortuneCache = source
          .split(/\r?\n%\r?\n/)
          .map(fortune => fortune.trim())
          .filter(Boolean);
      }
      if (!fortuneCache.length) throw new Error('empty fortune database');
      appendLine(fortuneCache[Math.floor(Math.random() * fortuneCache.length)], { tone: 'yellow' });
    } catch {
      appendLine('fortune: unable to reach the fortune database', { tone: 'error' });
    }
    scrollToBottom();
  }

  function setTheme(theme?: string) {
    if (!theme) {
      appendLine(`theme: ${currentTheme()}`);
      appendLine(`available: ${themes.join(', ')}`, { tone: 'muted' });
      return;
    }
    if (!themes.includes(theme)) {
      appendLine(`theme: unknown theme '${theme}'`, { tone: 'error' });
      return;
    }
    applyTheme(theme);
    persistState();
    appendLine(`theme switched to ${theme}`);
  }

  function setUsername(nextName?: string) {
    if (!nextName) {
      appendLine(username);
      return;
    }
    if (nextName === '--reset') nextName = 'you';
    if (!/^[a-zA-Z][a-zA-Z0-9._-]{0,23}$/.test(nextName)) {
      appendLine('name: use 1–24 letters, numbers, dots, underscores, or hyphens; start with a letter', { tone: 'error' });
      return;
    }
    fileSystem.migrateHome(nextName);
    username = nextName;
    updatePrompt();
    persistState();
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
          appendLine(`Recovery available: enter "${recoveryPasscode}" to bypass login and disable the password.`, { tone: 'yellow' });
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

  function requirePassword(action: () => void) {
    if (!passwordHash) action();
    else beginPasswordPrompt('verify', action);
  }

  function exitTerminal() {
    inputRow.remove();
    appendLine('logout');
    scrollToBottom();
    window.setTimeout(() => { window.location.href = '/'; }, 120);
  }

  function logoutSession() {
    appendLine('logout');
    if (passwordHash) {
      sessionStarted = false;
      beginPasswordPrompt('login');
    } else {
      window.setTimeout(() => { window.location.href = '/'; }, 120);
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

  function enterSession() {
    if (!sessionStarted) {
      appendLine(`Last login: ${new Date().toLocaleString()} from ${window.location.hostname || 'localhost'}`, { tone: 'muted' });
      appendLine("Type 'help' to list all commands.");
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
      storageEnabled,
      passwordOnRefresh,
      passwordEnabled: Boolean(passwordHash)
    }),
    previewTheme: applyTheme,
    save: async settings => {
      fileSystem.migrateHome(settings.username);
      username = settings.username;
      computerName = settings.computerName;
      cursorStyle = settings.cursorStyle;
      cursorBlink = settings.cursorBlink;
      passwordOnRefresh = settings.passwordOnRefresh;
      if (settings.passwordAction === 'set') passwordHash = await hashPassword(settings.passwordDraft);
      else if (settings.passwordAction === 'disable') passwordHash = null;
      applyTheme(settings.theme);
      applyCursorSettings();
      updateStoragePreference(settings.storageEnabled);
      persistState();
    },
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

  function showManual(command?: string) {
    const manuals: Record<string, string> = {
      cd: 'cd [directory] — change the current working directory. cd with no path returns home.',
      ls: 'ls [-a] [directory] — list directory contents. -a includes hidden entries.',
      cat: 'cat <file>... — concatenate files and print them to standard output.',
      clear: 'clear — clear the terminal screen. Ctrl+L does the same thing.',
      history: 'history — print commands entered during this session.',
      name: 'name [username] — show or change the prompt username. name --reset restores "you".',
      fastfetch: 'fastfetch — show this profile\'s system, technology, and audio setup.',
      settings: 'settings — open the terminal settings TUI.',
      passwd: 'passwd [--disable] — set a password, or disable it if forgotten.',
      theme: `theme [${themes.join('|')}] — inspect or change the terminal palette.`,
      top: 'top — open the live York task monitor. Use arrows or J/K to select, Space to pause, and Q to quit.',
      touch: 'touch <file>... — create empty files or update existing files.',
      rm: 'rm [-r] <path>... — remove files or directories from the virtual filesystem.',
      open: 'open <target> — open home, github, lastfm, music, or a custom HTTP(S) URL.'
    };
    if (!command) appendLine('What manual page do you want?', { tone: 'error' });
    else if (manuals[command]) appendLine(manuals[command]);
    else appendLine(`No manual entry for ${command}`, { tone: 'error' });
  }

  function runCommand(value: string) {
    const parsed = tokenize(value);
    if ('error' in parsed) {
      appendLine(parsed.error, { tone: 'error' });
      return;
    }
    const { command, args } = parsed;
    if (!command) return;
    if (!commandNames.includes(command)) {
      appendLine(`${command}: command not found. Type 'help' for available commands.`, { tone: 'error' });
      return;
    }
    if (args.includes('-h') || args.includes('--help')) {
      printUsage(command);
      return;
    }
    if (!validateOptions(command, args)) return;

    switch (command) {
      case 'help':
        if (args[0] && commandNames.includes(args[0])) printUsage(args[0]);
        else printHelp();
        break;
      case 'about': readFiles(['~/about.txt']); break;
      case 'pwd': appendLine(fileSystem.currentPath); break;
      case 'whoami': appendLine(username); break;
      case 'hostname': appendLine(computerName); break;
      case 'id': appendLine(`uid=524(${username})`); break;
      case 'uname': appendLine(args.includes('-a') ? `York Profile CLI ${computerName} ${appMetadata.version} web64 JavaScript/Astro` : 'York Profile CLI'); break;
      case 'env':
        appendLine(`USER=${username}\nHOSTNAME=${computerName}\nHOME=${fileSystem.homePath}\nSHELL=/bin/yorksh\nTERM=xterm-256color\nPWD=${fileSystem.currentPath}`);
        break;
      case 'date': appendLine(new Date().toString()); break;
      case 'echo': appendLine(args.join(' ')); break;
      case 'ls': listDirectory(args); break;
      case 'cat': readFiles(args); break;
      case 'cd': {
        const destination = normalizePath(args[0] ?? '~');
        if (!directories[destination]) appendLine(`cd: ${args[0] ?? ''}: No such file or directory`, { tone: 'error' });
        else {
          fileSystem.currentPath = destination;
          updatePrompt();
        }
        break;
      }
      case 'clear': output.replaceChildren(); break;
      case 'history': commandHistory.forEach((entry, index) => appendLine(`${String(index + 1).padStart(4)}  ${entry}`)); break;
      case 'fortune': void printFortune(); break;
      case 'fastfetch': printFastfetch(); break;
      case 'name': setUsername(args[0]); break;
      case 'passwd': configurePassword(args); break;
      case 'settings': settingsTuiApp.open(); break;
      case 'open': openTarget(args[0]); break;
      case 'theme': setTheme(args[0]); break;
      case 'top': topTuiApp.open(); break;
      case 'touch': touchFiles(args); break;
      case 'man': showManual(args[0]); break;
      case 'exit': exitTerminal(); break;
      case 'logout': logoutSession(); break;
      case 'sudo': appendLine(`${username} is not in the sudoers file. This incident will be reported to York.`, { tone: 'error' }); break;
      case 'rm': {
        const recursive = args.some(arg => /^-[rRf]+$/.test(arg) && /[rR]/.test(arg));
        if (recursive) requirePassword(() => removeFiles(args));
        else removeFiles(args);
        break;
      }
      default:
        appendLine(`${command}: not implemented`, { tone: 'error' });
    }
  }

  function submitCommand() {
    const value = input.value;
    appendCommandLine(value);
    if (value.trim()) {
      if (commandHistory.at(-1) !== value) commandHistory.push(value);
      persistState();
      runCommand(value);
    }
    input.value = '';
    completionSession = null;
    historyIndex = commandHistory.length;
    historyDraft = '';
    reverseSearchIndex = -1;
    updateInputPresentation();
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
      } else if (event.ctrlKey && event.key.toLowerCase() === 'c') {
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
    } else if (event.key === 'ArrowRight' && (input.selectionStart ?? 0) === input.value.length && acceptGhostCompletion()) {
      event.preventDefault();
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
    if (event.target instanceof HTMLAnchorElement || !pointerStart) return;
    const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5;
    pointerStart = null;
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!moved && (!selection || selection.isCollapsed)) input.focus({ preventScroll: true });
    });
  });

  try {
    storageEnabled = localStorage.getItem(storageKeys.enabled) !== 'false';
    if (storageEnabled) {
      const savedTheme = localStorage.getItem(storageKeys.theme);
      const savedUsername = localStorage.getItem(storageKeys.username);
      const savedComputerName = localStorage.getItem(storageKeys.computerName);
      const savedCursorStyle = localStorage.getItem(storageKeys.cursorStyle);
      const savedCursorBlink = localStorage.getItem(storageKeys.cursorBlink);
      const savedPasswordHash = localStorage.getItem(storageKeys.passwordHash);
      const savedPasswordOnRefresh = localStorage.getItem(storageKeys.passwordOnRefresh);
      const savedHistory = JSON.parse(localStorage.getItem(storageKeys.history) ?? '[]') as unknown;
      const savedFilesystem = JSON.parse(localStorage.getItem(storageKeys.filesystem) ?? 'null') as {
        directories?: Record<string, unknown>;
        files?: Record<string, unknown>;
      } | null;
      if (savedTheme && themes.includes(savedTheme)) applyTheme(savedTheme);
      if (savedUsername && /^[a-zA-Z][a-zA-Z0-9._-]{0,23}$/.test(savedUsername)) username = savedUsername;
      if (savedComputerName && /^[a-zA-Z][a-zA-Z0-9.-]{0,23}$/.test(savedComputerName)) computerName = savedComputerName;
      if (savedCursorStyle === 'block' || savedCursorStyle === 'bar' || savedCursorStyle === 'underscore') cursorStyle = savedCursorStyle;
      cursorBlink = savedCursorBlink === 'true';
      if (savedPasswordHash && /^[a-f0-9]{64}$/.test(savedPasswordHash)) passwordHash = savedPasswordHash;
      passwordOnRefresh = savedPasswordOnRefresh !== 'false';
      if (Array.isArray(savedHistory)) {
        commandHistory.push(...savedHistory.filter(item => typeof item === 'string').slice(-100));
      }
      fileSystem.restore(savedFilesystem);
    }
  } catch { /* Storage may be unavailable. */ }

  fileSystem.migrateHome(username);
  historyIndex = commandHistory.length;
  applyCursorSettings();
  appendSegments([segment('York Profile CLI', 'accent'), segment(` ${appMetadata.version}`, 'muted')]);
  if (passwordHash && passwordOnRefresh) beginPasswordPrompt('login');
  else enterSession();
}
