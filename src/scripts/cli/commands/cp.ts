import { copyEntry, resolveDestination } from './fs-helpers';
import type { CommandDefinition } from './types';

export const cpCommand: CommandDefinition = {
  name: 'cp',
  usage: 'cp [-h] [-rR|--recursive] <source>... <destination>',
  description: 'copy files and directories',
  manual: 'Copy virtual files. Use -r, -R, or --recursive to copy directories. Multiple sources require an existing destination directory.',
  completion: 'path',
  isOptionAllowed: option => /^-[rR]+$/.test(option) || option === '--recursive',
  execute: ({ fileSystem, persist, terminal }, args) => {
    const recursive = args.some(arg => /^-[rR]+$/.test(arg) || arg === '--recursive');
    const operands = args.filter(arg => !arg.startsWith('-'));
    if (operands.length < 2) {
      terminal.appendLine(`cp: missing destination file operand after '${operands[0] ?? ''}'`, { tone: 'error' });
      return;
    }
    const destinationArg = operands.at(-1)!;
    const destination = fileSystem.normalize(destinationArg);
    const sources = operands.slice(0, -1);
    if (sources.length > 1 && !fileSystem.directories[destination]) {
      terminal.appendLine(`cp: target '${destinationArg}' is not a directory`, { tone: 'error' });
      return;
    }
    let changed = false;
    for (const sourceArg of sources) {
      const source = fileSystem.normalize(sourceArg);
      const target = resolveDestination(fileSystem, source, destination);
      const error = copyEntry(fileSystem, source, target, recursive);
      if (error) terminal.appendLine(`cp: cannot copy '${sourceArg}' to '${destinationArg}': ${error}`, { tone: 'error' });
      else changed = true;
    }
    if (changed) persist();
  }
};
