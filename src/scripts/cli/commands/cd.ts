import type { CommandDefinition } from './types';

export const cdCommand: CommandDefinition = {
  name: 'cd',
  usage: 'cd [-h] [directory]',
  description: 'change the working directory',
  manual: 'Change the current working directory. With no directory, return to the current user’s home.',
  completion: 'directory',
  execute: ({ fileSystem, terminal, updatePrompt }, args) => {
    const destination = fileSystem.normalize(args[0] ?? '~');
    if (!fileSystem.directories[destination]) {
      terminal.appendLine(`cd: ${args[0] ?? ''}: No such file or directory`, { tone: 'error' });
      return;
    }
    fileSystem.currentPath = destination;
    updatePrompt();
  }
};
