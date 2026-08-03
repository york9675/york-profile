import { isTheme, themeMetadata, themes } from '../config';
import type { CommandDefinition } from './types';

export const themeCommand: CommandDefinition = {
  name: 'theme',
  usage: 'theme [-h] [-l|--list] [name]',
  description: `switch between ${themes.length} terminal themes`,
  manual: 'Print or change the terminal palette. Use -l or --list to list every available theme.',
  completion: { values: themes },
  isOptionAllowed: option => option === '-l' || option === '--list',
  execute: ({ applyTheme, getSession, persist, terminal }, args) => {
    const currentTheme = getSession().theme;
    if (args.includes('-l') || args.includes('--list')) {
      themes.forEach(theme => {
        terminal.appendLine(
          `${theme === currentTheme ? '*' : ' '} ${theme.padEnd(13)} ${themeMetadata[theme].label}`
        );
      });
      return;
    }
    const theme = args[0];
    if (!theme) {
      terminal.appendLine(`theme: ${currentTheme}`);
      return;
    }
    if (!isTheme(theme)) {
      terminal.appendLine(`theme: unknown theme '${theme}'`, { tone: 'error' });
      return;
    }
    applyTheme(theme);
    persist();
    terminal.appendLine(`theme switched to ${theme}`);
  }
};
