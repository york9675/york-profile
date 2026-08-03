import { createInitialFileSystem, defaultSettings } from './config';
import type { FileSystemSnapshot } from './types';

export class VirtualFileSystem {
  readonly directories: Record<string, string[]> = {};
  readonly files: Record<string, string[]> = {};
  readonly modifiedAt: Record<string, string> = {};
  private readonly readOnlyPaths = new Set<string>();
  homePath: string;
  currentPath: string;

  constructor(username: string) {
    this.homePath = `/home/${defaultSettings.username}`;
    this.currentPath = this.homePath;
    this.reset(username);
  }

  reset(username: string = defaultSettings.username) {
    const initial = createInitialFileSystem();
    Object.keys(this.directories).forEach(path => { delete this.directories[path]; });
    Object.keys(this.files).forEach(path => { delete this.files[path]; });
    Object.keys(this.modifiedAt).forEach(path => { delete this.modifiedAt[path]; });
    Object.assign(this.directories, initial.directories);
    Object.assign(this.files, initial.files);
    Object.assign(this.modifiedAt, initial.modifiedAt);
    this.readOnlyPaths.clear();
    initial.readOnlyPaths.forEach(path => this.readOnlyPaths.add(path));
    this.homePath = `/home/${defaultSettings.username}`;
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

  kind(path: string): 'file' | 'directory' | null {
    if (this.files[path]) return 'file';
    if (this.directories[path]) return 'directory';
    return null;
  }

  isReadOnly(path: string) {
    return this.readOnlyPaths.has(path);
  }

  getModifiedAt(path: string) {
    return this.modifiedAt[path] ?? new Date().toISOString();
  }

  basename(path: string) {
    return path.split('/').filter(Boolean).at(-1) ?? '';
  }

  dirname(path: string) {
    const parts = path.split('/').filter(Boolean);
    return parts.length <= 1 ? '/' : `/${parts.slice(0, -1).join('/')}`;
  }

  childPath(parent: string, name: string) {
    return parent === '/' ? `/${name}` : `${parent}/${name}`;
  }

  addDirectory(path: string) {
    if (this.kind(path)) return false;
    const parent = this.dirname(path);
    const name = this.basename(path);
    if (!name || !this.directories[parent] || this.isReadOnly(parent)) return false;
    const changedAt = new Date().toISOString();
    this.directories[path] = [];
    this.modifiedAt[path] = changedAt;
    this.modifiedAt[parent] = changedAt;
    if (!this.directories[parent].includes(name)) this.directories[parent].push(name);
    return true;
  }

  writeFile(path: string, lines: string[]) {
    if (this.directories[path] || this.isReadOnly(path)) return false;
    const parent = this.dirname(path);
    const name = this.basename(path);
    if (!name || !this.directories[parent] || (!this.files[path] && this.isReadOnly(parent))) return false;
    const changedAt = new Date().toISOString();
    this.files[path] = [...lines];
    this.modifiedAt[path] = changedAt;
    this.modifiedAt[parent] = changedAt;
    if (!this.directories[parent].includes(name)) this.directories[parent].push(name);
    return true;
  }

  touch(path: string) {
    if (!this.files[path] || this.isReadOnly(path)) return false;
    this.modifiedAt[path] = new Date().toISOString();
    return true;
  }

  remove(path: string) {
    const kind = this.kind(path);
    if (!kind || this.walk(path).some(entry => this.isReadOnly(entry))) return false;
    if (kind === 'directory') {
      for (const child of [...this.directories[path]]) {
        this.remove(this.childPath(path, child));
      }
      delete this.directories[path];
    } else {
      delete this.files[path];
    }
    delete this.modifiedAt[path];
    const parent = this.dirname(path);
    const name = this.basename(path);
    if (this.directories[parent]) {
      this.directories[parent] = this.directories[parent].filter(entry => entry !== name);
      this.modifiedAt[parent] = new Date().toISOString();
    }
    return true;
  }

  walk(path: string): string[] {
    const kind = this.kind(path);
    if (!kind) return [];
    if (kind === 'file') return [path];
    return [
      path,
      ...this.directories[path].flatMap(child => this.walk(this.childPath(path, child)))
    ];
  }

  migrateHome(nextUsername: string) {
    const nextHomePath = `/home/${nextUsername}`;
    if (nextHomePath === this.homePath) return;
    const previousHomePath = this.homePath;
    const directoryMoves = Object.entries(this.directories)
      .filter(([path]) => path === previousHomePath || path.startsWith(`${previousHomePath}/`));
    const fileMoves = Object.entries(this.files)
      .filter(([path]) => path.startsWith(`${previousHomePath}/`));
    const dateMoves = Object.entries(this.modifiedAt)
      .filter(([path]) => path === previousHomePath || path.startsWith(`${previousHomePath}/`));
    const readOnlyMoves = [...this.readOnlyPaths]
      .filter(path => path === previousHomePath || path.startsWith(`${previousHomePath}/`));

    directoryMoves.forEach(([path]) => { delete this.directories[path]; });
    fileMoves.forEach(([path]) => { delete this.files[path]; });
    dateMoves.forEach(([path]) => { delete this.modifiedAt[path]; });
    readOnlyMoves.forEach(path => this.readOnlyPaths.delete(path));
    directoryMoves.forEach(([path, entries]) => {
      this.directories[`${nextHomePath}${path.slice(previousHomePath.length)}`] = entries;
    });
    fileMoves.forEach(([path, lines]) => {
      this.files[`${nextHomePath}${path.slice(previousHomePath.length)}`] = lines;
    });
    dateMoves.forEach(([path, date]) => {
      this.modifiedAt[`${nextHomePath}${path.slice(previousHomePath.length)}`] = date;
    });
    readOnlyMoves.forEach(path => {
      this.readOnlyPaths.add(`${nextHomePath}${path.slice(previousHomePath.length)}`);
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
    return {
      directories: this.directories,
      files: this.files,
      modifiedAt: this.modifiedAt,
      readOnlyPaths: [...this.readOnlyPaths]
    };
  }

  restore(snapshot: {
    directories?: Record<string, unknown>;
    files?: Record<string, unknown>;
    modifiedAt?: Record<string, unknown>;
  } | null) {
    if (!snapshot?.directories || !snapshot.files) return;
    for (const path of Object.keys(this.directories)) delete this.directories[path];
    for (const path of Object.keys(this.files)) delete this.files[path];
    for (const path of Object.keys(this.modifiedAt)) delete this.modifiedAt[path];
    for (const [path, entries] of Object.entries(snapshot.directories)) {
      if (Array.isArray(entries)) this.directories[path] = entries.filter(entry => typeof entry === 'string');
    }
    for (const [path, lines] of Object.entries(snapshot.files)) {
      if (Array.isArray(lines)) this.files[path] = lines.filter(line => typeof line === 'string');
    }
    const restoredAt = new Date().toISOString();
    for (const path of [...Object.keys(this.directories), ...Object.keys(this.files)]) {
      const date = snapshot.modifiedAt?.[path];
      this.modifiedAt[path] = typeof date === 'string' && !Number.isNaN(Date.parse(date))
        ? date
        : restoredAt;
    }
  }
}
