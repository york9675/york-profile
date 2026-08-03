import type { CommandDefinition } from './types';

export const settingsCommand: CommandDefinition = {
  name: 'settings',
  usage: 'settings [-h]',
  description: 'open terminal settings',
  manual: 'Open the fullscreen keyboard-driven settings TUI for identity, theme, cursor, authentication, defaults, and typed-confirmation data clearing.',
  execute: ({ openSettings }) => openSettings()
};
