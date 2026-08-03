import type { CliTheme, CursorStyle } from '../config';
import type { AppMetadata } from '../types';
import type { VirtualFileSystem } from '../filesystem';
import type { TerminalView } from '../terminal';

export interface RuntimeSession {
  username: string;
  computerName: string;
  theme: CliTheme;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  passwordEnabled: boolean;
  passwordOnRefresh: boolean;
}

export type ArgumentCompletion =
  | 'none'
  | 'path'
  | 'file'
  | 'directory'
  | 'command'
  | { values: readonly string[] };

export interface CommandContext {
  terminal: TerminalView;
  fileSystem: VirtualFileSystem;
  metadata: AppMetadata;
  history: readonly string[];
  commands: readonly CommandDefinition[];
  getSession: () => RuntimeSession;
  updateSession: (patch: Partial<Pick<RuntimeSession, 'username' | 'computerName' | 'cursorStyle' | 'cursorBlink' | 'passwordOnRefresh'>>) => void;
  persist: () => void;
  updatePrompt: () => void;
  applyTheme: (theme: CliTheme) => void;
  requirePassword: (action: () => void) => void;
  exitTerminal: () => void;
  logoutSession: () => void;
  configurePassword: (args: string[]) => void;
  requestDataReset: () => void;
  openSettings: () => void;
  openTop: () => void;
  openEditor: (file?: string) => void;
  openManual: (commandName?: string) => void;
}

export interface CommandDefinition {
  name: string;
  usage: string;
  description: string;
  manual: string;
  completion?: ArgumentCompletion | ((args: readonly string[]) => ArgumentCompletion);
  isOptionAllowed?: (option: string) => boolean;
  execute: (context: CommandContext, args: string[]) => unknown;
}
