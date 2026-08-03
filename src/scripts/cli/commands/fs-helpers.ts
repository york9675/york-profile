import type { VirtualFileSystem } from '../filesystem';

export function resolveDestination(
  fileSystem: VirtualFileSystem,
  source: string,
  destination: string
) {
  return fileSystem.directories[destination]
    ? fileSystem.childPath(destination, fileSystem.basename(source))
    : destination;
}

export function copyEntry(
  fileSystem: VirtualFileSystem,
  source: string,
  destination: string,
  recursive: boolean
): string | null {
  const sourceKind = fileSystem.kind(source);
  if (!sourceKind) return 'No such file or directory';
  if (source === destination) return 'Source and destination are the same file';
  if (fileSystem.isReadOnly(destination)) return 'Permission denied';
  if (sourceKind === 'directory' && destination.startsWith(`${source}/`)) {
    return 'Cannot copy a directory into itself';
  }
  if (!fileSystem.directories[fileSystem.dirname(destination)]) return 'No such file or directory';

  if (sourceKind === 'file') {
    if (fileSystem.directories[destination]) return 'Cannot overwrite a directory with a file';
    if (!fileSystem.writeFile(destination, fileSystem.files[source])) return 'Permission denied';
    return null;
  }

  if (!recursive) return 'Omitting directory';
  if (fileSystem.files[destination]) return 'Cannot overwrite a file with a directory';
  if (!fileSystem.directories[destination] && !fileSystem.addDirectory(destination)) return 'Permission denied';
  for (const child of fileSystem.directories[source]) {
    const error = copyEntry(
      fileSystem,
      fileSystem.childPath(source, child),
      fileSystem.childPath(destination, child),
      true
    );
    if (error) return error;
  }
  return null;
}

export function moveEntry(
  fileSystem: VirtualFileSystem,
  source: string,
  destination: string
): string | null {
  const sourceKind = fileSystem.kind(source);
  if (!sourceKind) return 'No such file or directory';
  if (source === destination) return 'Source and destination are the same file';
  if (
    fileSystem.isReadOnly(source)
    || fileSystem.isReadOnly(destination)
    || fileSystem.isReadOnly(fileSystem.dirname(source))
  ) return 'Permission denied';
  if (sourceKind === 'directory' && destination.startsWith(`${source}/`)) {
    return 'Cannot move a directory into itself';
  }
  const destinationKind = fileSystem.kind(destination);
  if (destinationKind === 'directory') return 'File exists';
  if (sourceKind === 'directory' && destinationKind === 'file') {
    return 'Cannot overwrite a file with a directory';
  }
  if (destinationKind === 'file') fileSystem.remove(destination);
  const error = copyEntry(fileSystem, source, destination, true);
  if (error) return error;
  fileSystem.remove(source);
  return null;
}
