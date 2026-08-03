import type { CommandContext, CommandDefinition } from './types';

function removeEntry(context: CommandContext, path: string, recursive: boolean, displayName: string) {
  const { fileSystem, terminal } = context;
  if (
    path === '/'
    || path === fileSystem.homePath
    || path === fileSystem.currentPath
    || fileSystem.currentPath.startsWith(`${path}/`)
  ) {
    terminal.appendLine(`rm: cannot remove '${displayName}': Operation not permitted`, { tone: 'error' });
    return false;
  }
  if (fileSystem.isReadOnly(path) || fileSystem.isReadOnly(fileSystem.dirname(path))) {
    terminal.appendLine(`rm: cannot remove '${displayName}': Permission denied`, { tone: 'error' });
    return false;
  }
  if (fileSystem.files[path]) return fileSystem.remove(path);
  if (fileSystem.directories[path]) {
    if (!recursive) {
      terminal.appendLine(`rm: cannot remove '${displayName}': Is a directory`, { tone: 'error' });
      return false;
    }
    if (fileSystem.walk(path).some(entry => fileSystem.isReadOnly(entry))) {
      terminal.appendLine(`rm: cannot remove '${displayName}': Permission denied`, { tone: 'error' });
      return false;
    }
    return fileSystem.remove(path);
  }
  terminal.appendLine(`rm: cannot remove '${displayName}': No such file or directory`, { tone: 'error' });
  return false;
}

export const rmCommand: CommandDefinition = {
  name: 'rm',
  usage: 'rm [-h] [-rRf] <path>...',
  description: 'remove files or directories',
  manual: 'Remove virtual files. -r or -R recursively removes directories and requires password verification when a password is configured.',
  completion: 'path',
  isOptionAllowed: option => /^-[rRf]+$/.test(option),
  execute: (context, args) => {
    const recursive = args.some(arg => /^-[rRf]+$/.test(arg) && /[rR]/.test(arg));
    const targets = args.filter(arg => !arg.startsWith('-'));
    if (!targets.length) {
      context.terminal.appendLine('rm: missing operand', { tone: 'error' });
      return;
    }
    const remove = () => {
      let changed = false;
      targets.forEach(target => {
        changed = removeEntry(context, context.fileSystem.normalize(target), recursive, target) || changed;
      });
      if (changed) context.persist();
    };
    if (recursive) context.requirePassword(remove);
    else remove();
  }
};
