import type { CommandDefinition } from './types';

export const catCommand: CommandDefinition = {
  name: 'cat',
  usage: 'cat [-h] <file>...',
  description: 'read one or more files',
  manual: 'Concatenate virtual files and print their contents to standard output.',
  completion: 'file',
  execute: ({ fileSystem, terminal }, args) => {
    if (!args.length) {
      terminal.appendLine('cat: missing file operand', { tone: 'error' });
      return;
    }
    for (const file of args) {
      const path = fileSystem.normalize(file);
      if (fileSystem.directories[path]) {
        terminal.appendLine(`cat: ${file}: Is a directory`, { tone: 'error' });
      } else if (!fileSystem.files[path]) {
        terminal.appendLine(`cat: ${file}: No such file or directory`, { tone: 'error' });
      } else {
        fileSystem.files[path].forEach(line => terminal.appendLine(line));
      }
    }
  }
};
