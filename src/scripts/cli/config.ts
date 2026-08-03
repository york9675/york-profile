import { profile } from '../../data/app';
import { nowPlayingConfig, profileLinks, projectLinks } from '../../data/config';
import type { FileSystemSnapshot } from './types';

export const cliConfig = {
  name: 'York Profile CLI',
  shellName: 'yorksh',
  homeRoute: '/',
  userId: 524,
  historyLimit: 100,
  documentationPath: 'src/scripts/cli/docs/cli-development.md',
  repositoryLabel: profileLinks.projectRepository.replace(/^https?:\/\//, ''),
  repositoryUrl: profileLinks.projectRepository,
  documentationUrl: projectLinks.documentation,
  pullRequestUrl: projectLinks.newPullRequest
} as const;

export const serviceUrls = {
  fortune: 'https://raw.githubusercontent.com/bmc/fortunes/master/fortunes',
  ipLookup: 'https://ipwho.is/'
} as const;

export const openAliases = {
  home: cliConfig.homeRoute,
  github: profileLinks.github,
  lastfm: nowPlayingConfig.profileUrl,
  music: profileLinks.bandcamp
} as const;

export const themes = [
  'green',
  'amber',
  'mono',
  'nord',
  'dracula',
  'solarized',
  'gruvbox',
  'tokyo-night',
  'catppuccin',
  'everforest',
  'rose-pine',
  'one-dark'
] as const;
export const cursorStyles = ['block', 'bar', 'underscore'] as const;

export type CliTheme = typeof themes[number];
export type CursorStyle = typeof cursorStyles[number];

export const themeMetadata = {
  green: { label: 'Green', background: '#07110b' },
  amber: { label: 'Amber', background: '#130d04' },
  mono: { label: 'Monochrome', background: '#080808' },
  nord: { label: 'Nord', background: '#2e3440' },
  dracula: { label: 'Dracula', background: '#282a36' },
  solarized: { label: 'Solarized Dark', background: '#002b36' },
  gruvbox: { label: 'Gruvbox Dark', background: '#282828' },
  'tokyo-night': { label: 'Tokyo Night', background: '#1a1b26' },
  catppuccin: { label: 'Catppuccin Mocha', background: '#1e1e2e' },
  everforest: { label: 'Everforest', background: '#2d353b' },
  'rose-pine': { label: 'Rosé Pine', background: '#191724' },
  'one-dark': { label: 'One Dark', background: '#282c34' }
} as const satisfies Record<CliTheme, { label: string; background: `#${string}` }>;

export const defaultSettings = {
  username: 'you',
  computerName: 'profile',
  theme: themes[0],
  cursorStyle: cursorStyles[0],
  cursorBlink: false,
  passwordOnRefresh: true
} as const;

export const validation = {
  username: /^[a-zA-Z][a-zA-Z0-9._-]{0,23}$/,
  computerName: /^[a-zA-Z][a-zA-Z0-9.-]{0,23}$/,
  passwordHash: /^[a-f0-9]{64}$/
} as const;

export function isTheme(value: string): value is CliTheme {
  return themes.some(theme => theme === value);
}

export function isCursorStyle(value: string): value is CursorStyle {
  return cursorStyles.some(style => style === value);
}

export const storageKeys = {
  enabled: 'tcli-storage-enabled',
  username: 'tcli-username',
  computerName: 'tcli-computer-name',
  theme: 'tcli-theme',
  cursorStyle: 'tcli-cursor-style',
  cursorBlink: 'tcli-cursor-blink',
  passwordHash: 'tcli-password-hash',
  passwordOnRefresh: 'tcli-password-on-refresh',
  history: 'tcli-history',
  filesystem: 'tcli-filesystem'
} as const;

export const recoveryPasscode = 'help_me_RECOVERY';
export const dataResetConfirmation = 'DELETE';

export const topTasks = [
  { pid: 101, command: cliConfig.shellName, state: 'running', cpu: 4.8, memory: 1.2, description: 'Interactive York Profile shell' },
  { pid: 118, command: 'terminal-render', state: 'sleeping', cpu: 3.2, memory: 2.6, description: 'This is actually fake' },
  { pid: 136, command: 'astro-page', state: 'sleeping', cpu: 1.7, memory: 4.1, description: 'Looking cool!' },
  { pid: 152, command: 'preact-islands', state: 'sleeping', cpu: 1.1, memory: 2.0, description: 'Whatever, I want money.' },
  { pid: 524, command: 'profile-session', state: 'sleeping', cpu: 0.7, memory: 0.8, description: 'XD' }
];

export function createInitialFileSystem(): FileSystemSnapshot {
  const home = `/home/${defaultSettings.username}`;
  const directories = {
    '/': ['home'],
    '/home': [defaultSettings.username],
    [home]: ['about.txt', 'contact.txt', 'interests', 'projects', '.profile'],
    [`${home}/interests`]: ['aviation.txt', 'music.txt', 'photography.txt'],
    [`${home}/projects`]: ['README.md', 'york-profile'],
    [`${home}/projects/york-profile`]: ['README.md']
  };
  const files = {
    [`${home}/about.txt`]: [
      'York — developer, music lover, aviation fan, and curious human.',
      'This little shell is an easter egg inside my profile webpage.',
      'This is really very realistic!',
      'You can treat it just like a real terminal, and play around for a long time, at least that is what I personally did.',
      'It is a browser simulation: commands only affect the virtual filesystem stored by this page.',
      'Anyway, I hope you enjoy it! If you have any feedback, please let me know on GitHub.'
    ],
    [`${home}/contact.txt`]: [
      `email    ${profile.email}`,
      `github   ${profileLinks.github}`
    ],
    [`${home}/.profile`]: [`export HUMAN=${profile.name}`, `export HOME=${home}`, 'alias hi="echo hello"'],
    [`${home}/interests/aviation.txt`]: ['Civil aviation, Airbus cockpits, and flight simulation.'],
    [`${home}/interests/music.txt`]: ['Listening, collecting, and creating sounds as 524-Hz.'],
    [`${home}/interests/photography.txt`]: ['Learning photography one frame at a time with a Canon EOS R50.'],
    [`${home}/projects/README.md`]: ['Things York has built. Try: ls projects'],
    [`${home}/projects/york-profile/README.md`]: ['The Astro-powered profile you are visiting right now.']
  };
  const allPaths = [...Object.keys(directories), ...Object.keys(files)];
  const readOnlyPaths = [
    ...Object.keys(directories).filter(path => path !== home),
    ...Object.keys(files)
  ];
  const createdAt = new Date().toISOString();
  return {
    directories,
    files,
    modifiedAt: Object.fromEntries(allPaths.map(path => [path, createdAt])),
    readOnlyPaths
  };
}
