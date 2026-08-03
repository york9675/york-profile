import type { CommandDefinition } from './types';

export const dateCommand: CommandDefinition = {
  name: 'date',
  usage: 'date [-h]',
  description: 'show the current date and time',
  manual: 'Print the browser’s current local date, time, and time zone.',
  execute: ({ terminal }) => terminal.appendLine(new Date().toString())
};
