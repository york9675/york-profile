import type { CommandDefinition } from './types';

export const hostnameCommand: CommandDefinition = {
  name: 'hostname',
  usage: 'hostname [-h]',
  description: 'show the configured computer name',
  manual: 'Print the computer name configured in the settings TUI.',
  execute: ({ getSession, terminal }) => terminal.appendLine(getSession().computerName)
};
