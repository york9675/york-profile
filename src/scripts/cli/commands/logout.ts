import type { CommandDefinition } from './types';

export const logoutCommand: CommandDefinition = {
  name: 'logout',
  usage: 'logout [-h]',
  description: 'lock or end the terminal session',
  manual: 'Log out of the current shell. A configured password locks the terminal at login; without a password, return to the profile.',
  execute: ({ logoutSession }) => logoutSession()
};
