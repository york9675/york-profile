import { defaultSettings, validation } from '../config';
import type { CommandDefinition } from './types';

export const nameCommand: CommandDefinition = {
  name: 'name',
  usage: 'name [-h] [--reset|username]',
  description: 'inspect or change your username',
  manual: 'Print or change the prompt user name. --reset restores the default name “you” and migrates the virtual home directory.',
  isOptionAllowed: option => option === '--reset',
  execute: ({ fileSystem, getSession, persist, terminal, updatePrompt, updateSession }, args) => {
    let nextName = args[0];
    if (!nextName) {
      terminal.appendLine(getSession().username);
      return;
    }
    if (nextName === '--reset') nextName = defaultSettings.username;
    if (!validation.username.test(nextName)) {
      terminal.appendLine('name: use 1–24 letters, numbers, dots, underscores, or hyphens; start with a letter', { tone: 'error' });
      return;
    }
    fileSystem.migrateHome(nextName);
    updateSession({ username: nextName });
    updatePrompt();
    persist();
  }
};
