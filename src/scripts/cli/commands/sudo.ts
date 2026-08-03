import type { CommandDefinition } from './types';

export const sudoCommand: CommandDefinition = {
  name: 'sudo',
  usage: 'sudo [-h] <command>',
  description: 'run the supported administrative data-reset command',
  manual: "Administrative commands are normally unavailable. 'sudo rm -rf /' clears all locally stored terminal settings, history, passwords, and virtual files after typed confirmation.",
  completion: args => args.length ? 'path' : 'command',
  isOptionAllowed: option => /^-[rRf]+$/.test(option),
  execute: ({ getSession, requestDataReset, terminal }, args) => {
    const rmArgs = args.slice(1);
    const options = rmArgs.filter(arg => arg.startsWith('-'));
    const targets = rmArgs.filter(arg => !arg.startsWith('-'));
    const recursive = options.some(option => /[rR]/.test(option));
    const force = options.some(option => option.includes('f'));
    if (args[0] === 'rm' && recursive && force && targets.length === 1 && targets[0] === '/') {
      requestDataReset();
      return;
    }
    terminal.appendLine(`${getSession().username} is not in the sudoers file. This incident will be reported to York.`, { tone: 'error' });
  }
};
