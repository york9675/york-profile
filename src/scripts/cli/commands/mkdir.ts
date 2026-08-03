import type { CommandDefinition } from './types';

export const mkdirCommand: CommandDefinition = {
  name: 'mkdir',
  usage: 'mkdir [-h] [-p|--parents] <directory>...',
  description: 'create directories',
  manual: 'Create one or more virtual directories. -p or --parents creates missing parent directories and ignores directories that already exist.',
  completion: 'directory',
  isOptionAllowed: option => option === '-p' || option === '--parents',
  execute: ({ fileSystem, persist, terminal }, args) => {
    const parents = args.includes('-p') || args.includes('--parents');
    const targets = args.filter(arg => !arg.startsWith('-'));
    if (!targets.length) {
      terminal.appendLine('mkdir: missing operand', { tone: 'error' });
      return;
    }
    let changed = false;
    for (const target of targets) {
      const path = fileSystem.normalize(target);
      if (fileSystem.kind(path)) {
        if (!parents || fileSystem.files[path]) {
          terminal.appendLine(`mkdir: cannot create directory '${target}': File exists`, { tone: 'error' });
        }
        continue;
      }
      if (!parents) {
        if (!fileSystem.addDirectory(path)) {
          const reason = fileSystem.isReadOnly(fileSystem.dirname(path))
            ? 'Permission denied'
            : 'No such file or directory';
          terminal.appendLine(`mkdir: cannot create directory '${target}': ${reason}`, { tone: 'error' });
        } else changed = true;
        continue;
      }
      let current = '';
      let failed = false;
      for (const part of path.split('/').filter(Boolean)) {
        current = `${current}/${part}`;
        if (fileSystem.files[current]) {
          terminal.appendLine(`mkdir: cannot create directory '${target}': Not a directory`, { tone: 'error' });
          failed = true;
          break;
        }
        if (!fileSystem.directories[current]) {
          if (fileSystem.isReadOnly(fileSystem.dirname(current))) {
            terminal.appendLine(`mkdir: cannot create directory '${target}': Permission denied`, { tone: 'error' });
            failed = true;
            break;
          }
          changed = fileSystem.addDirectory(current) || changed;
        }
      }
      if (failed) continue;
    }
    if (changed) persist();
  }
};
