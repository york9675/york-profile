import type { CommandDefinition } from './types';

export const exitCommand: CommandDefinition = {
  name: 'exit',
  usage: 'exit [-h]',
  description: 'leave the terminal and return to the profile',
  manual: 'Print logout and return to the profile home page without authentication. Ctrl+D on an empty prompt is equivalent.',
  execute: ({ exitTerminal }) => exitTerminal()
};
