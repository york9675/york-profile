import { cliConfig } from '../config';
import { segment } from '../terminal';
import type { CommandDefinition } from './types';

export const helpCommand: CommandDefinition = {
  name: 'help',
  usage: 'help [-h] [command]',
  description: 'list all commands or show command usage',
  manual: 'List every available command. When a command name is supplied, print its usage synopsis.',
  completion: 'command',
  execute: ({ commands, terminal }, args) => {
    if (args[0]) {
      const command = commands.find(candidate => candidate.name === args[0]);
      if (command) terminal.appendLine(`Usage: ${command.usage}`);
      else terminal.appendLine(`help: no such command '${args[0]}'`, { tone: 'error' });
      return;
    }
    terminal.appendSegments([
      segment(`${cliConfig.name} commands`, 'bright'),
      segment('  (arguments in '),
      segment('[brackets]', 'muted'),
      segment(' are optional)')
    ]);
    const labels = commands.map(command => command.usage.replace(/ \[-h\]/, ''));
    const labelWidth = Math.max(...labels.map(label => label.length)) + 3;
    commands.forEach((command, index) => {
      terminal.appendSegments([
        segment(`  ${labels[index].padEnd(labelWidth)}`, 'accent'),
        segment(command.description)
      ]);
    });
  }
};
