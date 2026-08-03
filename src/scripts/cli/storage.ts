import { cliConfig, storageKeys } from './config';
import type { CliTheme, CursorStyle } from './config';
import type { FileSystemSnapshot } from './types';

export interface CliStoredState {
  enabled: boolean;
  username: string | null;
  computerName: string | null;
  theme: string | null;
  cursorStyle: string | null;
  cursorBlink: string | null;
  passwordHash: string | null;
  passwordOnRefresh: string | null;
  history: unknown;
  filesystem: Partial<FileSystemSnapshot> | null;
}

export interface CliStateToStore {
  username: string;
  computerName: string;
  theme: CliTheme;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  passwordHash: string | null;
  passwordOnRefresh: boolean;
  history: readonly string[];
  filesystem: FileSystemSnapshot;
}

const dataKeys = Object.values(storageKeys);

function parseJson(value: string | null, fallback: unknown) {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

export function loadCliState(): CliStoredState {
  return {
    enabled: localStorage.getItem(storageKeys.enabled) !== 'false',
    username: localStorage.getItem(storageKeys.username),
    computerName: localStorage.getItem(storageKeys.computerName),
    theme: localStorage.getItem(storageKeys.theme),
    cursorStyle: localStorage.getItem(storageKeys.cursorStyle),
    cursorBlink: localStorage.getItem(storageKeys.cursorBlink),
    passwordHash: localStorage.getItem(storageKeys.passwordHash),
    passwordOnRefresh: localStorage.getItem(storageKeys.passwordOnRefresh),
    history: parseJson(localStorage.getItem(storageKeys.history), []),
    filesystem: parseJson(localStorage.getItem(storageKeys.filesystem), null) as Partial<FileSystemSnapshot> | null
  };
}

export function saveCliState(state: CliStateToStore) {
  localStorage.setItem(storageKeys.enabled, 'true');
  localStorage.setItem(storageKeys.username, state.username);
  localStorage.setItem(storageKeys.computerName, state.computerName);
  localStorage.setItem(storageKeys.theme, state.theme);
  localStorage.setItem(storageKeys.cursorStyle, state.cursorStyle);
  localStorage.setItem(storageKeys.cursorBlink, String(state.cursorBlink));
  localStorage.setItem(storageKeys.passwordOnRefresh, String(state.passwordOnRefresh));
  if (state.passwordHash) localStorage.setItem(storageKeys.passwordHash, state.passwordHash);
  else localStorage.removeItem(storageKeys.passwordHash);
  localStorage.setItem(storageKeys.history, JSON.stringify(state.history.slice(-cliConfig.historyLimit)));
  localStorage.setItem(storageKeys.filesystem, JSON.stringify(state.filesystem));
}

export function clearCliStorage() {
  dataKeys.forEach(key => localStorage.removeItem(key));
}
