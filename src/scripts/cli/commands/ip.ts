import { getPublicIpInfo } from '../services/ip';
import type { CommandDefinition } from './types';
import { withLoadingStatus } from './utils';

export const ipCommand: CommandDefinition = {
  name: 'ip',
  usage: 'ip [-h]',
  description: 'show your public IP address and country',
  manual: 'Look up the browser’s public IP address and approximate country using the ipwho.is geolocation service.',
  execute: async ({ terminal }) => {
    try {
      const data = await withLoadingStatus(terminal, 'ip: fetching public IP...', getPublicIpInfo);
      if (!data.country) throw new Error(data.message ?? 'invalid response');
      const details = [
        ['IP Address', `${data.ip}${data.type ? ` (${data.type})` : ''}`],
        ['Country', `${data.country}${data.country_code ? ` (${data.country_code})` : ''}`],
        ['City', data.city],
        ['Continent', data.continent]
      ].filter((entry): entry is [string, string] => Boolean(entry[1]));
      const labelWidth = Math.max(...details.map(([label]) => label.length));
      details.forEach(([label, value]) => terminal.appendLine(`${label.padEnd(labelWidth)} : ${value}`));
    } catch {
      terminal.appendLine('ip: unable to retrieve public IP information', { tone: 'error' });
    }
    terminal.scrollToBottom();
  }
};
