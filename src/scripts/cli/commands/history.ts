import { cliConfig } from '../config';
import type { CommandDefinition } from './types';

export const historyCommand: CommandDefinition = {
  name: 'history',
  usage: 'history [-h]',
  description: 'show command history',
  manual: `Print commands retained by the current ${cliConfig.name} history, including entries restored from local storage.`,
  execute: ({ history, terminal }) => {
    history.forEach((entry, index) => terminal.appendLine(`${String(index + 1).padStart(4)}  ${entry}`));
  }
};
