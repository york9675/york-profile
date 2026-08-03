import type { CommandDefinition } from './types';

export const clearCommand: CommandDefinition = {
  name: 'clear',
  usage: 'clear [-h]',
  description: 'clear the terminal output',
  manual: 'Clear all visible terminal output. Ctrl+L performs the same action.',
  execute: ({ terminal }) => terminal.clearOutput()
};
