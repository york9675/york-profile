import type { CommandDefinition } from './types';

export const topCommand: CommandDefinition = {
  name: 'top',
  usage: 'top [-h]',
  description: 'open the interactive task monitor',
  manual: 'Open the live task monitor. Use arrows or J/K to select, Enter for details, Space to pause, and Q or Esc to quit.',
  execute: ({ openTop }) => openTop()
};
