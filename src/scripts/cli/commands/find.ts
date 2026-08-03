import type { VirtualFileSystem } from '../filesystem';
import type { CommandDefinition } from './types';

function globPattern(pattern: string) {
  const expression = [...pattern].map(character => {
    if (character === '*') return '.*';
    if (character === '?') return '.';
    return character.replace(/[\\^$.[\]{}()+|]/g, '\\$&');
  }).join('');
  return new RegExp(`^${expression}$`);
}

function displayPath(fileSystem: VirtualFileSystem, rootArg: string, path: string) {
  const root = fileSystem.normalize(rootArg);
  const suffix = path.slice(root.length);
  if (rootArg === '.') return `.${suffix}`;
  if (rootArg === '~') return `~${suffix}`;
  const label = rootArg === '/' ? '' : rootArg.replace(/\/$/, '');
  return `${label}${suffix}` || '/';
}

export const findCommand: CommandDefinition = {
  name: 'find',
  usage: 'find [-h] [path...] [-name pattern] [-type f|d]',
  description: 'search for files and directories',
  manual: 'Recursively search virtual paths. -name filters basenames using * and ? wildcards; -type f or -type d limits results to files or directories.',
  completion: args => args.at(-1) === '-name' || args.at(-1) === '-type' ? 'none' : 'path',
  isOptionAllowed: option => option === '-name' || option === '-type',
  execute: ({ fileSystem, terminal }, args) => {
    const roots: string[] = [];
    let namePattern = '*';
    let type: 'f' | 'd' | null = null;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '-name') {
        if (!args[index + 1]) {
          terminal.appendLine('find: missing argument to -name', { tone: 'error' });
          return;
        }
        namePattern = args[++index];
      } else if (arg === '-type') {
        const value = args[++index];
        if (value !== 'f' && value !== 'd') {
          terminal.appendLine(`find: invalid argument '${value ?? ''}' to -type`, { tone: 'error' });
          return;
        }
        type = value;
      } else {
        roots.push(arg);
      }
    }
    const matcher = globPattern(namePattern);
    for (const rootArg of roots.length ? roots : ['.']) {
      const root = fileSystem.normalize(rootArg);
      if (!fileSystem.kind(root)) {
        terminal.appendLine(`find: '${rootArg}': No such file or directory`, { tone: 'error' });
        continue;
      }
      for (const path of fileSystem.walk(root)) {
        const kind = fileSystem.kind(path);
        const name = fileSystem.basename(path) || '/';
        if (!matcher.test(name)) continue;
        if (type === 'f' && kind !== 'file') continue;
        if (type === 'd' && kind !== 'directory') continue;
        terminal.appendLine(displayPath(fileSystem, rootArg, path));
      }
    }
  }
};
