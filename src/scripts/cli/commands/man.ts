import type { CommandDefinition } from './types';

export const manCommand: CommandDefinition = {
  name: 'man',
  usage: 'man [-h] <command>',
  description: 'open a fullscreen command manual',
  manual: 'Open the requested command’s manual in a fullscreen terminal pager. Use arrows, J/K, Page Up/Down, Home/End, Q, or Esc.',
  completion: 'command',
  execute: ({ openManual }, args) => openManual(args[0])
};
