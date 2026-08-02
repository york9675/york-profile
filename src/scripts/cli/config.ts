import type { FileSystemSnapshot } from './types';

export const defaultSettings = {
  username: 'you',
  computerName: 'profile',
  theme: 'green',
  cursorStyle: 'block',
  cursorBlink: false,
  storageEnabled: true,
  passwordOnRefresh: true
} as const;

export const themes = ['green', 'amber', 'mono', 'nord', 'dracula', 'solarized'];

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

export const fortuneSource = 'https://raw.githubusercontent.com/bmc/fortunes/master/fortunes';
export const recoveryPasscode = 'help_me_RECOVERY';

export const commandNames = [
  'about', 'cat', 'cd', 'clear', 'date', 'echo', 'env', 'exit', 'fortune',
  'fastfetch', 'help', 'history', 'hostname', 'id', 'logout', 'ls', 'man', 'name', 'open',
  'passwd', 'pwd', 'rm', 'settings', 'sudo', 'theme', 'top', 'touch', 'uname', 'whoami'
];

export const commandUsage: Record<string, string> = {
  about: 'about [-h]',
  cat: 'cat [-h] <file>...',
  cd: 'cd [-h] [directory]',
  clear: 'clear [-h]',
  date: 'date [-h]',
  echo: 'echo [-h] [text...]',
  env: 'env [-h]',
  exit: 'exit [-h]',
  fastfetch: 'fastfetch [-h]',
  fortune: 'fortune [-h]',
  help: 'help [-h] [command]',
  history: 'history [-h]',
  hostname: 'hostname [-h]',
  id: 'id [-h]',
  logout: 'logout [-h]',
  ls: 'ls [-h] [-a] [-l] [directory]',
  man: 'man [-h] <command>',
  name: 'name [-h] [--reset|username]',
  open: 'open [-h] <alias|http(s)://url>',
  passwd: 'passwd [-h] [--disable]',
  pwd: 'pwd [-h]',
  rm: 'rm [-h] [-rRf] <path>...',
  settings: 'settings [-h]',
  sudo: 'sudo [-h] <command>',
  theme: `theme [-h] [${themes.join('|')}]`,
  top: 'top [-h]',
  touch: 'touch [-h] <file>...',
  uname: 'uname [-h] [-a]',
  whoami: 'whoami [-h]'
};

export const topTasks = [
  { pid: 101, command: 'yorksh', state: 'running', cpu: 4.8, memory: 1.2, description: 'Interactive York Profile shell' },
  { pid: 118, command: 'terminal-render', state: 'sleeping', cpu: 3.2, memory: 2.6, description: 'This is actually fake' },
  { pid: 136, command: 'astro-page', state: 'sleeping', cpu: 1.7, memory: 4.1, description: 'Looking cool!' },
  { pid: 152, command: 'preact-islands', state: 'sleeping', cpu: 1.1, memory: 2.0, description: 'I want money.' },
  { pid: 524, command: 'profile-session', state: 'sleeping', cpu: 0.7, memory: 0.8, description: 'XD' }
];

export function createInitialFileSystem(): FileSystemSnapshot {
  return {
    directories: {
      '/': ['home'],
      '/home': ['you'],
      '/home/you': ['about.txt', 'contact.txt', 'interests', 'projects', '.profile'],
      '/home/you/interests': ['aviation.txt', 'music.txt', 'photography.txt'],
      '/home/you/projects': ['README.md', 'york-profile'],
      '/home/you/projects/york-profile': ['README.md']
    },
    files: {
      '/home/you/about.txt': [
        'York — developer, music lover, aviation fan, and curious human.',
        'This little shell is an easter egg inside my profile webpage.',
        'This is really very realistic!',
        'You can treat it just like a real terminal, and play around for a long time, at least that is what I personally did.',
        'But please note this is still very work-in-progress, and have to tell you this is just a simulation, not a real terminal.',
        'Anyway, I hope you enjoy it! If you have any feedback, please let me know on GitHub.'
      ],
      '/home/you/contact.txt': [
        'email    york@york.qzz.io',
        'github   https://github.com/york9675'
      ],
      '/home/you/.profile': ['export HUMAN=York', 'export HOME=/home/you', 'alias hi="echo hello"'],
      '/home/you/interests/aviation.txt': ['Civil aviation, Airbus cockpits, and flight simulation.'],
      '/home/you/interests/music.txt': ['Listening, collecting, and creating sounds as 524-Hz.'],
      '/home/you/interests/photography.txt': ['Learning photography one frame at a time with a Canon EOS R50.'],
      '/home/you/projects/README.md': ['Things York has built. Try: ls projects'],
      '/home/you/projects/york-profile/README.md': ['The Astro-powered profile you are visiting right now.']
    }
  };
}
