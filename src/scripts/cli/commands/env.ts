import type { CommandDefinition } from './types';

export const envCommand: CommandDefinition = {
  name: 'env',
  usage: 'env [-h]',
  description: 'show the live terminal environment and settings',
  manual: 'Print the active shell environment, including user-configurable terminal settings. Password secrets are never displayed.',
  execute: ({ fileSystem, getSession, history, terminal }) => {
    const session = getSession();
    const variables = {
      USER: session.username,
      HOSTNAME: session.computerName,
      HOME: fileSystem.homePath,
      PWD: fileSystem.currentPath,
      LANG: navigator.language || 'unknown',
      THEME: session.theme,
      CURSOR_STYLE: session.cursorStyle,
      CURSOR_BLINK: session.cursorBlink ? 'enabled' : 'disabled',
      LOCAL_STORAGE: 'enabled',
      PASSWORD: session.passwordEnabled ? 'enabled' : 'disabled',
      PASSWORD_ON_REFRESH: session.passwordOnRefresh ? 'enabled' : 'disabled',
      HISTORY_SIZE: String(history.length)
    };
    terminal.appendLine(Object.entries(variables).map(([key, value]) => `${key}=${value}`).join('\n'));
  }
};
