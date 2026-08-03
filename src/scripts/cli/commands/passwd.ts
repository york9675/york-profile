import type { CommandDefinition } from './types';

export const passwdCommand: CommandDefinition = {
  name: 'passwd',
  usage: 'passwd [-h] [--disable]',
  description: 'set or disable the local password',
  manual: 'Set a local terminal password using hidden input, or disable it with --disable.',
  isOptionAllowed: option => option === '--disable',
  execute: ({ configurePassword }, args) => configurePassword(args)
};
