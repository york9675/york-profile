import type { CommandDefinition } from './types';

export const echoCommand: CommandDefinition = {
  name: 'echo',
  usage: 'echo [-h] [text...]',
  description: 'write text to the terminal',
  manual: 'Write the provided arguments to standard output, separated by spaces.',
  execute: ({ terminal }, args) => terminal.appendLine(args.join(' '))
};
