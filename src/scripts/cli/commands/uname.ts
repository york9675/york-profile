import { cliConfig } from '../config';
import type { CommandDefinition } from './types';

export const unameCommand: CommandDefinition = {
  name: 'uname',
  usage: 'uname [-h] [-a]',
  description: 'show CLI system information',
  manual: `Print the ${cliConfig.name} operating-system name. -a includes host, version, platform, and stack information.`,
  isOptionAllowed: option => option === '-a',
  execute: ({ getSession, metadata, terminal }, args) => {
    terminal.appendLine(args.includes('-a')
      ? `${cliConfig.name} ${getSession().computerName} ${metadata.version} web64 JavaScript/Astro`
      : cliConfig.name);
  }
};
