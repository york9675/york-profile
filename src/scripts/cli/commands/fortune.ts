import { serviceUrls } from '../config';
import type { CommandDefinition } from './types';
import { withLoadingStatus } from './utils';

let cache: string[] | null = null;

export const fortuneCommand: CommandDefinition = {
  name: 'fortune',
  usage: 'fortune [-h]',
  description: 'fetch a Unix fortune',
  manual: 'Fetch the Unix fortune database on first use, cache it for this page session, and print one random entry.',
  execute: async ({ terminal }) => {
    try {
      await withLoadingStatus(terminal, 'fortune: fetching...', async () => {
        if (cache) return;
        const response = await fetch(serviceUrls.fortune);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        cache = (await response.text()).split(/\r?\n%\r?\n/).map(fortune => fortune.trim()).filter(Boolean);
      });
      if (!cache.length) throw new Error('empty fortune database');
      terminal.appendLine(cache[Math.floor(Math.random() * cache.length)], { tone: 'yellow' });
    } catch {
      terminal.appendLine('fortune: unable to reach the fortune database', { tone: 'error' });
    }
    terminal.scrollToBottom();
  }
};
