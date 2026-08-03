import type { CommandDefinition } from './types';

export const pwdCommand: CommandDefinition = {
  name: 'pwd',
  usage: 'pwd [-h]',
  description: 'print the working directory',
  manual: 'Print the absolute path of the current virtual working directory.',
  execute: ({ fileSystem, terminal }) => terminal.appendLine(fileSystem.currentPath)
};
