import { catCommand } from './cat';
import { cdCommand } from './cd';
import { clearCommand } from './clear';
import { cpCommand } from './cp';
import { dateCommand } from './date';
import { echoCommand } from './echo';
import { envCommand } from './env';
import { exitCommand } from './exit';
import { fastfetchCommand } from './fastfetch';
import { findCommand } from './find';
import { fortuneCommand } from './fortune';
import { grepCommand } from './grep';
import { helpCommand } from './help';
import { historyCommand } from './history';
import { hostnameCommand } from './hostname';
import { idCommand } from './id';
import { ipCommand } from './ip';
import { logoutCommand } from './logout';
import { lsCommand } from './ls';
import { manCommand } from './man';
import { mkdirCommand } from './mkdir';
import { mvCommand } from './mv';
import { nanoCommand } from './nano';
import { nameCommand } from './name';
import { neofetchCommand } from './neofetch';
import { openCommand } from './open';
import { passwdCommand } from './passwd';
import { pwdCommand } from './pwd';
import { rmCommand } from './rm';
import { sdkCommand } from './sdk';
import { settingsCommand } from './settings';
import { sudoCommand } from './sudo';
import { themeCommand } from './theme';
import { topCommand } from './top';
import { touchCommand } from './touch';
import { unameCommand } from './uname';
import { whoamiCommand } from './whoami';

export const commands = [
  catCommand,
  cdCommand,
  clearCommand,
  cpCommand,
  dateCommand,
  echoCommand,
  envCommand,
  exitCommand,
  fastfetchCommand,
  findCommand,
  fortuneCommand,
  grepCommand,
  helpCommand,
  historyCommand,
  hostnameCommand,
  idCommand,
  ipCommand,
  logoutCommand,
  lsCommand,
  manCommand,
  mkdirCommand,
  mvCommand,
  nanoCommand,
  nameCommand,
  neofetchCommand,
  openCommand,
  passwdCommand,
  pwdCommand,
  rmCommand,
  sdkCommand,
  settingsCommand,
  sudoCommand,
  themeCommand,
  topCommand,
  touchCommand,
  unameCommand,
  whoamiCommand
] as const;

export const commandNames = commands.map(command => command.name);
export const commandMap = new Map(commands.map(command => [command.name, command]));

export type {
  ArgumentCompletion,
  CommandContext,
  CommandDefinition,
  RuntimeSession
} from './types';
