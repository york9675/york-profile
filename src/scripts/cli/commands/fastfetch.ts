import { cliConfig } from '../config';
import { getPublicIpInfo } from '../services/ip';
import { formatUptime, getBrowserName, getHeapInfo } from '../system';
import { boldSegment, segment } from '../terminal';
import type { Tone } from '../types';
import type { CommandDefinition } from './types';

interface ValueSuffix {
  prefix: string;
  text: string;
  suffix: string;
  tone: Tone;
}

type InfoRow = [string] | [string, string, Tone?, ValueSuffix?];

const logoTones: Tone[] = [
  'accent', 'accent', 'accent',
  'yellow', 'yellow', 'yellow',
  'error', 'error', 'error',
  'magenta', 'magenta', 'magenta',
  'blue', 'blue', 'blue',
  'cyan', 'cyan',
  'bright'
];

function heapTone(percentage: number | null): Tone {
  if (percentage === null) return 'muted';
  if (percentage >= 80) return 'error';
  if (percentage >= 60) return 'yellow';
  return 'accent';
}

export const fastfetchCommand: CommandDefinition = {
  name: 'fastfetch',
  usage: 'fastfetch [-h]',
  description: 'show profile, browser, and stack information',
  manual: `Display ${cliConfig.name} system information, this webpage’s technology stack, browser locale, active theme, and terminal color palette.`,
  execute: async ({ getSession, metadata, terminal }) => {
    const session = getSession();
    const art = [
      '                AAA',
      '              AAAAAAA',
      '            AAA  AA AAA',
      '          AAA    AA  AAAA',
      '        AAAA     AAAAAAAAAA',
      '       AAA AAA   AAAA    AAAA',
      '     AAA     AAA AAAA    AAAAAA',
      '   AAA         AAAAAAAAAAAA   AAA',
      ' AAA             AAAAAAAAA     AAA',
      '  AAA          AAAAAAA       AAA',
      '    AAA      AAASAA  AAA   AAAA',
      '      AAA  AAAA  AA    AAAAAA',
      '        AAAAA    AA     AAA',
      '          AAA    AA   AAA',
      '            AAA  AA AAA',
      '              AAAAAAA',
      '                AAAA',
      ''
    ];
    const infoColumn = Math.max(...art.map(line => line.length)) + 4;
    const locale = navigator.languages?.join(', ') || navigator.language || 'unknown';
    const heap = getHeapInfo();
    const heapPercentage = heap.percentageLabel
      ? { prefix: ' (', text: heap.percentageLabel, suffix: ')', tone: heapTone(heap.percentage) }
      : undefined;
    const info: InfoRow[] = [
      [`${session.username}@${session.computerName}`],
      ['----------------'],
      ['OS', `${cliConfig.name} ${metadata.version}`],
      ['Host', session.computerName],
      ['Uptime', formatUptime(performance.now() / 1000)],
      ['Packages', `${metadata.packageCount} (package.json)`],
      ['Shell', navigator.platform || 'Web Browser'],
      ['Theme', session.theme],
      ['Cursor', session.cursorStyle],
      ['Terminal', getBrowserName()],
      ['Framework', `Astro ${metadata.astro}`],
      ['Language', `TypeScript ${metadata.typescript}`],
      ['Environment', metadata.environment],
      ['Heap', heap.usage, heap.percentage === null ? 'muted' : undefined, heapPercentage],
      ['IP', 'fetching public IP...', 'muted'],
      ['Locale', locale],
      ['']
    ];
    const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    const createPalette = () => {
      const paletteStack = document.createElement('span');
      paletteStack.className = 'terminal-palette-stack';
      for (const bright of [false, true]) {
        const palette = document.createElement('span');
        palette.className = `terminal-palette${bright ? ' is-bright' : ''}`;
        palette.setAttribute('role', 'img');
        palette.setAttribute('aria-label', `${bright ? 'Bright' : 'Normal'} terminal color palette`);
        for (const color of colors) {
          const swatch = document.createElement('span');
          swatch.className = `terminal-palette-swatch is-${color}`;
          palette.append(swatch);
        }
        paletteStack.append(palette);
      }
      return paletteStack;
    };
    const paletteRow = info.length;
    const rows = Math.max(art.length, paletteRow + 1);
    let ipValueNode: Element | null = null;
    for (let index = 0; index < rows; index += 1) {
      const details = info[index];
      const isIdentity = index === 0;
      const isSeparator = details?.length === 1;
      const artLine = art[index] ?? '';
      const artSegments = artLine
        ? [boldSegment(artLine, logoTones[index] ?? 'bright')]
        : [];
      const infoSegments = isIdentity
        ? [
            boldSegment(session.username, 'yellow'),
            segment('@', 'bright'),
            boldSegment(session.computerName, 'yellow')
          ]
        : [
            isSeparator
              ? segment(details?.[0] ?? '', 'bright')
              : boldSegment(details?.[0] ?? '', 'accent'),
            segment(details?.[1] ? ': ' : ''),
            segment(details?.[1] ?? '', details?.[2]),
            ...(details?.[3]
              ? [
                  segment(details[3].prefix),
                  segment(details[3].text, details[3].tone),
                  segment(details[3].suffix)
                ]
              : [])
          ];
      const line = terminal.appendSegments([
        ...artSegments,
        segment(''.padEnd(infoColumn - artLine.length)),
        ...infoSegments
      ]);
      line.classList.add('terminal-fastfetch-line');
      if (details?.[0] === 'IP') ipValueNode = line.lastElementChild;
      if (index === paletteRow) {
        line.classList.add('terminal-palette-line');
        line.style.setProperty('--fastfetch-info-column', `${infoColumn}ch`);
        line.append(createPalette());
      }
    }
    try {
      const data = await getPublicIpInfo();
      if (ipValueNode) {
        const countryCode = data.country_code?.toUpperCase();
        ipValueNode.textContent = `${data.ip ?? 'unavailable'}${countryCode ? ` (${countryCode})` : ''}`;
        ipValueNode.classList.remove('terminal-muted', 'terminal-error');
      }
    } catch {
      if (ipValueNode) {
        ipValueNode.textContent = 'unavailable';
        ipValueNode.classList.add('terminal-error');
      }
    }
    terminal.scrollToBottom();
  }
};
