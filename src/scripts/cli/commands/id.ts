import { cliConfig } from '../config';
import type { CommandDefinition } from './types';

export const idCommand: CommandDefinition = {
  name: 'id',
  usage: 'id [-h]',
  description: 'show the current virtual user identity',
  manual: 'Print the virtual numeric user ID and configured user name.',
  execute: ({ getSession, terminal }) => terminal.appendLine(`uid=${cliConfig.userId}(${getSession().username})`)
};
