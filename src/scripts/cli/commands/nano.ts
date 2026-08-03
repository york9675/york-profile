import type { CommandDefinition } from './types';

export const nanoCommand: CommandDefinition = {
  name: 'nano',
  usage: 'nano [-h] [file]',
  description: 'edit a file in the fullscreen text editor',
  manual: 'Open or create a virtual file in the fullscreen nano editor. Without a file name, saving opens a File Name to Write prompt. Use Shift with navigation keys or pointer dragging to select text, Ctrl+C to copy, Ctrl+S or Ctrl+O to save, Ctrl+X to exit, Ctrl+W to search, and Ctrl+G for editor help.',
  completion: 'path',
  execute: ({ fileSystem, openEditor, terminal }, args) => {
    const file = args[0];
    if (args.length > 1) {
      terminal.appendLine(`nano: extra operand '${args[1]}'`, { tone: 'error' });
      return;
    }
    if (file) {
      const path = fileSystem.normalize(file);
      if (fileSystem.directories[path]) {
        terminal.appendLine(`nano: ${file}: Is a directory`, { tone: 'error' });
        return;
      }
      if (!fileSystem.directories[fileSystem.dirname(path)]) {
        terminal.appendLine(`nano: ${file}: No such file or directory`, { tone: 'error' });
        return;
      }
      if (!fileSystem.files[path] && fileSystem.isReadOnly(fileSystem.dirname(path))) {
        terminal.appendLine(`nano: ${file}: Permission denied`, { tone: 'error' });
        return;
      }
      if (fileSystem.isReadOnly(path)) {
        terminal.appendLine(`nano: ${file}: Permission denied`, { tone: 'error' });
        return;
      }
    }
    openEditor(file);
  }
};
