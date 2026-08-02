import { createInitialFileSystem } from './config';
import type { FileSystemSnapshot } from './types';

export class VirtualFileSystem {
  readonly directories: Record<string, string[]>;
  readonly files: Record<string, string[]>;
  homePath: string;
  currentPath: string;

  constructor(username: string) {
    const initial = createInitialFileSystem();
    this.directories = initial.directories;
    this.files = initial.files;
    this.homePath = '/home/you';
    this.currentPath = this.homePath;
    this.migrateHome(username);
  }

  normalize(value = '.') {
    let rawPath = value;
    if (rawPath === '~') rawPath = this.homePath;
    if (rawPath.startsWith('~/')) rawPath = `${this.homePath}/${rawPath.slice(2)}`;
    if (!rawPath.startsWith('/')) rawPath = `${this.currentPath}/${rawPath}`;

    const parts: string[] = [];
    for (const part of rawPath.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return `/${parts.join('/')}`;
  }

  migrateHome(nextUsername: string) {
    const nextHomePath = `/home/${nextUsername}`;
    if (nextHomePath === this.homePath) return;
    const previousHomePath = this.homePath;
    const directoryMoves = Object.entries(this.directories)
      .filter(([path]) => path === previousHomePath || path.startsWith(`${previousHomePath}/`));
    const fileMoves = Object.entries(this.files)
      .filter(([path]) => path.startsWith(`${previousHomePath}/`));

    directoryMoves.forEach(([path]) => { delete this.directories[path]; });
    fileMoves.forEach(([path]) => { delete this.files[path]; });
    directoryMoves.forEach(([path, entries]) => {
      this.directories[`${nextHomePath}${path.slice(previousHomePath.length)}`] = entries;
    });
    fileMoves.forEach(([path, lines]) => {
      this.files[`${nextHomePath}${path.slice(previousHomePath.length)}`] = lines;
    });

    if (!this.directories[nextHomePath]) this.directories[nextHomePath] = [];
    const previousName = previousHomePath.split('/').at(-1) ?? '';
    const homeEntries = this.directories['/home'] ?? [];
    this.directories['/home'] = [
      ...new Set(homeEntries.map(entry => entry === previousName ? nextUsername : entry).concat(nextUsername))
    ];
    this.currentPath = this.currentPath === previousHomePath || this.currentPath.startsWith(`${previousHomePath}/`)
      ? `${nextHomePath}${this.currentPath.slice(previousHomePath.length)}`
      : this.currentPath;
    this.homePath = nextHomePath;

    const profileFile = this.files[`${this.homePath}/.profile`];
    if (profileFile) {
      this.files[`${this.homePath}/.profile`] = profileFile.map(line => (
        line.startsWith('export HOME=') ? `export HOME=${this.homePath}` : line
      ));
    }
  }

  snapshot(): FileSystemSnapshot {
    return { directories: this.directories, files: this.files };
  }

  restore(snapshot: { directories?: Record<string, unknown>; files?: Record<string, unknown> } | null) {
    if (!snapshot?.directories || !snapshot.files) return;
    for (const path of Object.keys(this.directories)) delete this.directories[path];
    for (const path of Object.keys(this.files)) delete this.files[path];
    for (const [path, entries] of Object.entries(snapshot.directories)) {
      if (Array.isArray(entries)) this.directories[path] = entries.filter(entry => typeof entry === 'string');
    }
    for (const [path, lines] of Object.entries(snapshot.files)) {
      if (Array.isArray(lines)) this.files[path] = lines.filter(line => typeof line === 'string');
    }
  }
}
