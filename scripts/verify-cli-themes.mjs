import { readFile } from 'node:fs/promises';

const requiredVariables = [
  'bg',
  'text',
  'bright',
  'muted',
  'accent',
  'blue',
  'yellow',
  'red',
  'magenta',
  'cyan',
  'palette-black'
];

const [configSource, cssSource] = await Promise.all([
  readFile(new URL('../src/scripts/cli/config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/cli.css', import.meta.url), 'utf8')
]);

const registrySource = configSource.match(/export const themes = \[([\s\S]*?)\] as const;/)?.[1];
if (!registrySource) throw new Error('Unable to read the CLI theme registry.');

const themeNames = [...registrySource.matchAll(/'([^']+)'/g)].map(match => match[1]);
const themeBlocks = new Map();
const defaultBlock = cssSource.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
if (defaultBlock) themeBlocks.set(themeNames[0], defaultBlock);
for (const match of cssSource.matchAll(/:root\[data-cli-theme="([^"]+)"\]\s*\{([\s\S]*?)\}/g)) {
  themeBlocks.set(match[1], match[2]);
}

const expandHex = value => value.length === 3
  ? value.split('').map(character => character.repeat(2)).join('')
  : value;

function luminance(color) {
  const hex = expandHex(color.slice(1));
  const channels = [0, 2, 4]
    .map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

const errors = [];
for (const themeName of themeNames) {
  const block = themeBlocks.get(themeName);
  if (!block) {
    errors.push(`${themeName}: missing CSS theme block`);
    continue;
  }
  const variables = Object.fromEntries(
    [...block.matchAll(/--terminal-([\w-]+):\s*(#[\da-f]{3,6})/gi)]
      .map(match => [match[1], match[2]])
  );
  for (const variable of requiredVariables) {
    if (!variables[variable]) errors.push(`${themeName}: missing --terminal-${variable}`);
  }
  if (!variables.bg) continue;
  for (const variable of ['text', 'accent', 'muted']) {
    if (!variables[variable]) continue;
    const ratio = contrast(variables.bg, variables[variable]);
    if (ratio < 4.5) {
      errors.push(`${themeName}: ${variable} contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
    }
  }
}

for (const themeName of themeBlocks.keys()) {
  if (!themeNames.includes(themeName)) errors.push(`${themeName}: CSS theme is not registered in config.ts`);
}

if (errors.length) {
  console.error(['CLI theme verification failed:', ...errors.map(error => `- ${error}`)].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${themeNames.length} complete CLI themes with accessible text contrast.`);
}
