import { segment } from '../terminal';
import type { CommandDefinition } from './types';

export const grepCommand: CommandDefinition = {
  name: 'grep',
  usage: 'grep [-h] [-in] <pattern> <file>...',
  description: 'search for text inside files',
  manual: 'Search virtual files using a JavaScript-compatible regular expression. -i ignores case and -n prints line numbers.',
  completion: args => args.some(arg => !arg.startsWith('-')) ? 'file' : 'none',
  isOptionAllowed: option => /^-[in]+$/.test(option),
  execute: ({ fileSystem, terminal }, args) => {
    const ignoreCase = args.some(arg => arg.startsWith('-') && arg.includes('i'));
    const lineNumbers = args.some(arg => arg.startsWith('-') && arg.includes('n'));
    const operands = args.filter(arg => !arg.startsWith('-'));
    const pattern = operands[0];
    const files = operands.slice(1);
    if (!pattern) {
      terminal.appendLine('grep: missing search pattern', { tone: 'error' });
      return;
    }
    if (!files.length) {
      terminal.appendLine('grep: missing file operand', { tone: 'error' });
      return;
    }
    let matcher: RegExp;
    try {
      matcher = new RegExp(pattern, ignoreCase ? 'i' : '');
    } catch {
      terminal.appendLine(`grep: invalid regular expression '${pattern}'`, { tone: 'error' });
      return;
    }
    const showFile = files.length > 1;
    for (const file of files) {
      const path = fileSystem.normalize(file);
      if (fileSystem.directories[path]) {
        terminal.appendLine(`grep: ${file}: Is a directory`, { tone: 'error' });
        continue;
      }
      const lines = fileSystem.files[path];
      if (!lines) {
        terminal.appendLine(`grep: ${file}: No such file or directory`, { tone: 'error' });
        continue;
      }
      lines.forEach((line, index) => {
        if (!matcher.test(line)) return;
        terminal.appendSegments([
          ...(showFile ? [segment(`${file}:`, 'magenta')] : []),
          ...(lineNumbers ? [segment(`${index + 1}:`, 'accent')] : []),
          segment(line)
        ]);
      });
    }
  }
};
