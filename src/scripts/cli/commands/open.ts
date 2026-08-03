import { segment } from '../terminal';
import { cliConfig, openAliases } from '../config';
import type { CommandDefinition } from './types';

function isValidHostname(hostname: string) {
  if (hostname === 'localhost' || hostname.includes(':')) return true;
  const ipv4 = hostname.split('.');
  if (ipv4.length === 4 && ipv4.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return true;
  if (ipv4.length === 4 && ipv4.every(part => /^\d+$/.test(part))) return false;
  const labels = hostname.split('.');
  return labels.length >= 2
    && labels.at(-1)!.length >= 2
    && /[a-z]/i.test(labels.at(-1)!)
    && labels.every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}

function parseDestination(target: string) {
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(target) ? target : `https://${target}`;
  const url = new URL(candidate);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol');
  if (url.username || url.password || !isValidHostname(url.hostname)) throw new Error('invalid hostname');
  return url.href;
}

export const openCommand: CommandDefinition = {
  name: 'open',
  usage: 'open [-h] <alias|domain|http(s)://url>',
  description: 'open a profile alias or validated URL',
  manual: 'Open home, github, lastfm, music, or a valid HTTP(S) URL. Bare domains must contain a valid dotted hostname; localhost and IP addresses are also accepted.',
  execute: ({ terminal }, args) => {
    const target = args[0];
    if (!target) {
      terminal.appendLine(`Usage: ${openCommand.usage}`);
      return;
    }
    let destination: string | undefined = openAliases[target as keyof typeof openAliases];
    if (!destination) {
      try {
        destination = parseDestination(target);
      } catch {
        terminal.appendLine(`open: '${target}' is not a valid HTTP(S) URL, domain, or profile alias`, { tone: 'error' });
        return;
      }
    }
    terminal.appendSegments([segment('opening '), segment(destination, 'blue', destination)]);
    if (target === 'home') window.setTimeout(() => { window.location.href = cliConfig.homeRoute; }, 180);
    else window.open(destination, '_blank', 'noopener,noreferrer');
  }
};
