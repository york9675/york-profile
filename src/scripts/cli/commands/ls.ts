import { segment } from '../terminal';
import type { Tone } from '../types';
import type { CommandDefinition } from './types';

function formatModifiedAt(value: string) {
  const date = new Date(value);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(2, ' ');
  const suffix = date.getFullYear() === new Date().getFullYear()
    ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : String(date.getFullYear());
  return `${month} ${day} ${suffix}`;
}

export const lsCommand: CommandDefinition = {
  name: 'ls',
  usage: 'ls [-h] [-a] [-l] [directory]',
  description: 'list directory contents',
  manual: 'List virtual directory contents. -a includes hidden entries; -l prints permissions, modification time, and one entry per line.',
  completion: 'directory',
  isOptionAllowed: option => /^-[al]+$/.test(option),
  execute: ({ fileSystem, terminal }, args) => {
    const showHidden = args.some(arg => arg.startsWith('-') && arg.includes('a'));
    const long = args.some(arg => arg.startsWith('-') && arg.includes('l'));
    const pathArg = args.find(arg => !arg.startsWith('-')) ?? '.';
    const path = fileSystem.normalize(pathArg);
    const entries = fileSystem.directories[path];
    if (!entries) {
      terminal.appendLine(`ls: cannot access '${pathArg}': No such directory`, { tone: 'error' });
      return;
    }
    const visible = showHidden ? ['.', '..', ...entries] : entries.filter(name => !name.startsWith('.'));
    if (long) {
      visible.forEach(name => {
        const absolute = fileSystem.normalize(path === '/' ? `/${name}` : `${path}/${name}`);
        const directory = Boolean(fileSystem.directories[absolute]);
        const permissions = directory
          ? fileSystem.isReadOnly(absolute) ? 'dr-xr-xr-x' : 'drwxr-xr-x'
          : fileSystem.isReadOnly(absolute) ? '-r--r--r--' : '-rw-r--r--';
        terminal.appendSegments([
          segment(`${permissions} ${formatModifiedAt(fileSystem.getModifiedAt(absolute))} `, 'muted'),
          segment(name, directory ? 'blue' : name.startsWith('.') ? 'muted' : undefined)
        ]);
      });
      return;
    }
    terminal.appendSegments(visible.flatMap((name, index) => {
      const absolute = fileSystem.normalize(path === '/' ? `/${name}` : `${path}/${name}`);
      const tone: Tone | undefined = fileSystem.directories[absolute]
        ? 'blue'
        : name.startsWith('.') ? 'muted' : undefined;
      return [segment(name, tone), segment(index === visible.length - 1 ? '' : '  ')];
    }));
  }
};
