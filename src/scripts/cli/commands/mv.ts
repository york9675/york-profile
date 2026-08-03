import { moveEntry, resolveDestination } from './fs-helpers';
import type { CommandDefinition } from './types';

export const mvCommand: CommandDefinition = {
  name: 'mv',
  usage: 'mv [-h] <source>... <destination>',
  description: 'move or rename files and directories',
  manual: 'Move or rename virtual files and directories. Multiple sources require an existing destination directory.',
  completion: 'path',
  execute: ({ fileSystem, persist, terminal }, args) => {
    if (args.length < 2) {
      terminal.appendLine(`mv: missing destination file operand after '${args[0] ?? ''}'`, { tone: 'error' });
      return;
    }
    const destinationArg = args.at(-1)!;
    const destination = fileSystem.normalize(destinationArg);
    const sources = args.slice(0, -1);
    if (sources.length > 1 && !fileSystem.directories[destination]) {
      terminal.appendLine(`mv: target '${destinationArg}' is not a directory`, { tone: 'error' });
      return;
    }
    let changed = false;
    for (const sourceArg of sources) {
      const source = fileSystem.normalize(sourceArg);
      if (
        source === '/'
        || source === fileSystem.homePath
        || source === fileSystem.currentPath
        || fileSystem.currentPath.startsWith(`${source}/`)
      ) {
        terminal.appendLine(`mv: cannot move '${sourceArg}': Operation not permitted`, { tone: 'error' });
        continue;
      }
      const target = resolveDestination(fileSystem, source, destination);
      const error = moveEntry(fileSystem, source, target);
      if (error) terminal.appendLine(`mv: cannot move '${sourceArg}' to '${destinationArg}': ${error}`, { tone: 'error' });
      else changed = true;
    }
    if (changed) persist();
  }
};
