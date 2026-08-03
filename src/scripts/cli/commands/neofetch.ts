import { cliConfig } from '../config';
import type { CommandDefinition } from './types';

export const neofetchCommand: CommandDefinition = {
  name: 'neofetch',
  usage: 'neofetch [-h]',
  description: 'deprecated system-information command',
  manual: `Neofetch is not available in ${cliConfig.name}. Migrate to fastfetch for system and profile information.`,
  execute: ({ terminal }) => {
    const line = terminal.appendLine("neofetch: deprecated; use 'fastfetch' instead", { tone: 'error' });
    line.classList.add('terminal-bold');
  }
};
