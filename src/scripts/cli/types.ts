import type { CliTheme, CursorStyle } from './config';

export type Tone = 'muted' | 'accent' | 'blue' | 'yellow' | 'error' | 'magenta' | 'cyan' | 'bright' | 'bold';

export interface Segment {
  text: string;
  tone?: Tone;
  href?: string;
  bold?: boolean;
}

export interface ParsedCommand {
  command: string;
  args: string[];
}

export interface Completion {
  start: number;
  end: number;
  token: string;
  candidates: string[];
}

export interface CompletionSession {
  prefix: string;
  suffix: string;
  candidates: string[];
  index: number;
}

export interface SettingsTuiState {
  screen: HTMLElement;
  selected: number;
  editing: boolean;
  editCursor: number;
  username: string;
  computerName: string;
  theme: CliTheme;
  originalTheme: CliTheme;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  passwordOnRefresh: boolean;
  passwordAction: 'unchanged' | 'set' | 'disable';
  passwordDraft: string;
  editOriginal: string;
  status: string;
  resetArmed: boolean;
}

export interface PasswordPrompt {
  mode: 'login' | 'verify' | 'new' | 'confirm';
  firstValue?: string;
  onVerified?: () => void;
}

export interface ConfirmationPrompt {
  message: string;
  expected: string;
  onConfirm: () => void;
}

export interface TopTuiState {
  screen: HTMLElement;
  selected: number;
  paused: boolean;
  showDetails: boolean;
  tick: number;
  intervalId: number;
}

export interface AppMetadata {
  version: string;
  environment: string;
  astro: string;
  preact: string;
  typescript: string;
  packageCount: number;
}

export interface FileSystemSnapshot {
  directories: Record<string, string[]>;
  files: Record<string, string[]>;
  modifiedAt: Record<string, string>;
  readOnlyPaths: string[];
}
