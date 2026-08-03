import type { CommandDefinition } from './types';

export const whoamiCommand: CommandDefinition = {
  name: 'whoami',
  usage: 'whoami [-h]',
  description: 'show the current username',
  manual: 'Print the currently configured terminal user name.',
  execute: ({ getSession, terminal }) => terminal.appendLine(getSession().username)
};
