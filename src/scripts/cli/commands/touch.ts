import type { CommandDefinition } from './types';

function pathParts(path: string) {
  const parts = path.split('/').filter(Boolean);
  return { name: parts.at(-1) ?? '', parent: parts.length <= 1 ? '/' : `/${parts.slice(0, -1).join('/')}` };
}

export const touchCommand: CommandDefinition = {
  name: 'touch',
  usage: 'touch [-h] <file>...',
  description: 'create empty files',
  manual: 'Create empty writable files or update the modification time of existing writable files.',
  completion: 'path',
  execute: ({ fileSystem, persist, terminal }, args) => {
    if (!args.length) {
      terminal.appendLine('touch: missing file operand', { tone: 'error' });
      return;
    }
    let changed = false;
    for (const target of args) {
      const path = fileSystem.normalize(target);
      const { name, parent } = pathParts(path);
      if (!name || !fileSystem.directories[parent]) {
        terminal.appendLine(`touch: cannot touch '${target}': No such file or directory`, { tone: 'error' });
      } else if (fileSystem.directories[path]) {
        terminal.appendLine(`touch: cannot touch '${target}': Is a directory`, { tone: 'error' });
      } else if (fileSystem.files[path]) {
        if (fileSystem.touch(path)) changed = true;
        else terminal.appendLine(`touch: cannot touch '${target}': Permission denied`, { tone: 'error' });
      } else if (fileSystem.writeFile(path, [])) {
        changed = true;
      } else {
        terminal.appendLine(`touch: cannot touch '${target}': Permission denied`, { tone: 'error' });
      }
    }
    if (changed) persist();
  }
};
