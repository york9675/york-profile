import { cliConfig } from '../config';
import type { VirtualFileSystem } from '../filesystem';

interface EditorSnapshot {
  lines: string[];
  row: number;
  column: number;
}

interface EditorPosition {
  row: number;
  column: number;
}

type EditorMode = 'edit' | 'search' | 'save-as' | 'confirm-overwrite' | 'confirm-exit' | 'help';

interface EditorState {
  screen: HTMLElement;
  body: HTMLElement;
  statusBar: HTMLElement;
  filePath: string | null;
  displayName: string;
  lines: string[];
  row: number;
  column: number;
  preferredColumn: number | null;
  selectionAnchor: EditorPosition | null;
  dirty: boolean;
  savedContent: string;
  mode: EditorMode;
  prompt: string;
  status: string;
  pendingFilePath: string | null;
  closeAfterSave: boolean;
  cutBuffer: string[];
  undo: EditorSnapshot[];
  redo: EditorSnapshot[];
}

interface EditorTuiOptions {
  root: HTMLElement;
  input: HTMLInputElement;
  version: string;
  fileSystem: VirtualFileSystem;
  persist: () => void;
  onClose: () => void;
}

const maxUndoDepth = 100;

function serialize(lines: string[]) {
  return lines.join('\n');
}

export class NanoTuiApp {
  private state: EditorState | null = null;
  private pointerAnchor: EditorPosition | null = null;

  constructor(private readonly options: EditorTuiOptions) {}

  open(file?: string) {
    if (this.state) return;
    const filePath = file ? this.options.fileSystem.normalize(file) : null;
    const storedLines = filePath ? this.options.fileSystem.files[filePath] : undefined;
    const lines = storedLines?.length ? [...storedLines] : [''];
    const screen = document.createElement('section');
    screen.className = 'terminal-editor-screen';
    screen.setAttribute('role', 'application');
    screen.setAttribute('aria-label', `${cliConfig.name} text editor: ${file ?? 'new buffer'}`);

    const body = document.createElement('div');
    body.className = 'terminal-editor-body';
    body.addEventListener('pointerdown', this.handlePointerDown);
    body.addEventListener('pointermove', this.handlePointerMove);
    body.addEventListener('pointerup', this.handlePointerUp);
    const statusBar = document.createElement('div');
    statusBar.className = 'terminal-editor-status';

    this.state = {
      screen,
      body,
      statusBar,
      filePath,
      displayName: file ?? '[ New Buffer ]',
      lines,
      row: 0,
      column: 0,
      preferredColumn: null,
      selectionAnchor: null,
      dirty: false,
      savedContent: serialize(lines),
      mode: 'edit',
      prompt: '',
      status: storedLines ? `Read ${storedLines.length} line${storedLines.length === 1 ? '' : 's'}` : 'New File',
      pendingFilePath: null,
      closeAfterSave: false,
      cutBuffer: [],
      undo: [],
      redo: []
    };

    screen.append(this.createHeader(), body, statusBar, this.createShortcuts());
    this.options.root.append(screen);
    this.render();
    this.options.input.focus({ preventScroll: true });
  }

  handleKey(event: KeyboardEvent) {
    if (!this.state) return false;
    const key = event.key.toLowerCase();
    const control = event.ctrlKey && !event.metaKey;
    if (event.isComposing || event.key === 'Process') return true;
    if ((event.ctrlKey || event.metaKey) && key === 'v') return true;
    event.preventDefault();

    if (this.state.mode === 'confirm-exit') {
      if (key === 'y') {
        this.requestSave(true);
      } else if (key === 'n') {
        this.close();
      } else if (event.key === 'Escape' || (control && key === 'c')) {
        this.state.mode = 'edit';
        this.state.status = 'Exit cancelled';
        this.render();
      }
      return true;
    }

    if (this.state.mode === 'save-as') {
      this.handleSaveAsKey(event);
      return true;
    }

    if (this.state.mode === 'confirm-overwrite') {
      if (key === 'y') this.commitSaveAs();
      else if (key === 'n') {
        this.state.mode = 'save-as';
        this.state.pendingFilePath = null;
        this.state.status = 'Choose another file name';
        this.render();
      } else if (event.key === 'Escape' || (control && key === 'c')) {
        this.cancelSaveAs();
      }
      return true;
    }

    if (this.state.mode === 'search') {
      this.handleSearchKey(event);
      return true;
    }

    if (this.state.mode === 'help') {
      if (key === 'q' || event.key === 'Escape' || (control && (key === 'g' || key === 'x'))) {
        this.state.mode = 'edit';
        this.state.status = '';
        this.render();
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        this.state.body.scrollTop -= event.key === 'PageUp' ? this.state.body.clientHeight : 24;
      } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        this.state.body.scrollTop += event.key === 'PageDown' ? this.state.body.clientHeight : 24;
      }
      return true;
    }

    if ((event.metaKey || (control && event.shiftKey)) && key === 'a') {
      this.selectAll();
    } else if ((event.ctrlKey || event.metaKey) && key === 'c') {
      this.copySelection();
    } else if ((event.ctrlKey || event.metaKey) && key === 'x' && this.hasSelection()) {
      this.cutSelection();
    } else if (control && (key === 's' || key === 'o')) {
      this.requestSave(false);
    } else if (control && key === 'x') {
      this.requestClose();
    } else if (control && key === 'w') {
      this.state.mode = 'search';
      this.state.prompt = '';
    } else if (control && key === 'g') {
      this.state.mode = 'help';
    } else if ((control || event.metaKey) && key === 'z' && !event.shiftKey) {
      this.undo();
    } else if ((control && key === 'y') || (event.metaKey && key === 'z' && event.shiftKey)) {
      this.redo();
    } else if (control && key === 'k') {
      this.cutLine();
    } else if (control && key === 'u') {
      this.pasteCutBuffer();
    } else if (event.key === 'ArrowLeft' || (control && key === 'b')) {
      this.moveHorizontal(-1, event.shiftKey);
    } else if (event.key === 'ArrowRight' || (control && key === 'f')) {
      this.moveHorizontal(1, event.shiftKey);
    } else if (event.key === 'ArrowUp' || (control && key === 'p')) {
      this.moveVertical(-1, event.shiftKey);
    } else if (event.key === 'ArrowDown' || (control && key === 'n')) {
      this.moveVertical(1, event.shiftKey);
    } else if (event.key === 'PageUp') {
      this.moveVertical(-10, event.shiftKey);
    } else if (event.key === 'PageDown') {
      this.moveVertical(10, event.shiftKey);
    } else if (event.key === 'Home' || (control && key === 'a')) {
      this.moveToColumn(0, event.shiftKey);
    } else if (event.key === 'End' || (control && key === 'e')) {
      this.moveToColumn(this.currentLine().length, event.shiftKey);
    } else if (event.key === 'Enter') {
      this.insertNewline();
    } else if (event.key === 'Backspace') {
      this.backspace();
    } else if (event.key === 'Delete') {
      this.deleteForward();
    } else if (event.key === 'Tab') {
      this.insertText('  ');
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.insertText(event.key);
    } else {
      return true;
    }
    this.render();
    return true;
  }

  handleBeforeInput(event: InputEvent) {
    if (!this.state) return false;
    event.preventDefault();
    if (this.state.mode === 'search' || this.state.mode === 'save-as') {
      if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
        if (this.state.mode === 'search') {
          this.searchNext();
          this.state.mode = 'edit';
          this.render();
        } else this.prepareSaveAs();
        return true;
      }
      if (event.inputType.startsWith('delete')) this.state.prompt = this.state.prompt.slice(0, -1);
      else if (event.data) this.state.prompt += event.data;
      this.state.status = '';
      this.render();
      return true;
    }
    if (this.state.mode !== 'edit') return true;
    if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') this.insertNewline();
    else if (event.inputType === 'deleteContentBackward') this.backspace();
    else if (event.inputType === 'deleteContentForward') this.deleteForward();
    else if (event.data) this.insertText(event.data);
    this.render();
    return true;
  }

  handlePaste(event: ClipboardEvent) {
    if (!this.state) return false;
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return true;
    if (this.state.mode === 'search') {
      this.state.prompt += text.replace(/\r?\n/g, ' ');
      this.render();
      return true;
    }
    if (this.state.mode === 'save-as') {
      this.state.prompt += text.replace(/\r?\n/g, ' ');
      this.state.status = '';
      this.render();
      return true;
    }
    if (this.state.mode !== 'edit') return true;
    this.insertPastedText(text);
    this.render();
    return true;
  }

  private createHeader() {
    const header = document.createElement('header');
    header.className = 'terminal-editor-header';
    return header;
  }

  private createShortcuts() {
    const shortcuts = document.createElement('footer');
    shortcuts.className = 'terminal-editor-shortcuts';
    const entries = [
      ['^G', 'Help'], ['^S/^O', 'Save'], ['^W', 'Search'], ['^K', 'Cut Line'],
      ['^U', 'Paste'], ['^Z', 'Undo'], ['^Y', 'Redo'], ['^X', 'Exit'],
      ['⇧Arrows', 'Select'], ['^C', 'Copy']
    ];
    entries.forEach(([key, label]) => {
      const item = document.createElement('span');
      const keyNode = document.createElement('b');
      keyNode.textContent = key;
      item.append(keyNode, ` ${label}`);
      shortcuts.append(item);
    });
    return shortcuts;
  }

  private render() {
    if (!this.state) return;
    const { screen, statusBar } = this.state;
    const header = screen.querySelector<HTMLElement>('.terminal-editor-header');
    if (header) {
      header.textContent = ` ${cliConfig.name} nano ${this.options.version}   File: ${this.state.displayName}${this.state.dirty ? '   Modified' : ''}`;
    }

    if (this.state.mode === 'help') this.renderHelp();
    else this.renderBuffer();

    statusBar.classList.toggle(
      'is-prompt',
      this.state.mode === 'search'
        || this.state.mode === 'save-as'
        || this.state.mode === 'confirm-overwrite'
        || this.state.mode === 'confirm-exit'
    );
    if (this.state.mode === 'search') {
      statusBar.textContent = `Search: ${this.state.prompt}█`;
    } else if (this.state.mode === 'save-as') {
      statusBar.textContent = `File Name to Write: ${this.state.prompt}█${this.state.status ? `  [ ${this.state.status} ]` : ''}`;
    } else if (this.state.mode === 'confirm-overwrite') {
      statusBar.textContent = `File '${this.state.prompt}' exists; overwrite?  Y Yes   N No   Ctrl+C Cancel`;
    } else if (this.state.mode === 'confirm-exit') {
      statusBar.textContent = 'Save modified buffer?  Y Yes   N No   Ctrl+C Cancel';
    } else if (this.state.mode === 'help') {
      statusBar.textContent = 'Help  ·  Q, Esc, or Ctrl+G to return';
    } else {
      const position = `Line ${this.state.row + 1}/${this.state.lines.length}, Col ${this.state.column + 1}`;
      const selected = this.selectedText().length;
      const status = selected
        ? `${selected} character${selected === 1 ? '' : 's'} selected`
        : this.state.status;
      statusBar.textContent = status ? `${status}  ·  ${position}` : position;
    }
  }

  private renderBuffer() {
    if (!this.state) return;
    const { body, lines, row, column } = this.state;
    body.replaceChildren();
    const gutterWidth = String(lines.length).length;
    lines.forEach((text, index) => {
      const line = document.createElement('div');
      line.className = 'terminal-editor-line';
      line.dataset.editorRow = String(index);
      const gutter = document.createElement('span');
      gutter.className = 'terminal-editor-gutter';
      gutter.textContent = `${String(index + 1).padStart(gutterWidth)} `;
      const content = document.createElement('span');
      content.className = 'terminal-editor-content';
      for (let character = 0; character < text.length; character += 1) {
        const node = document.createElement('span');
        node.textContent = text[character];
        if (this.isCharacterSelected(index, character)) node.classList.add('terminal-editor-selection');
        if (index === row && character === column) node.classList.add('terminal-editor-cursor');
        content.append(node);
      }
      if (index === row && column === text.length) {
        const cursor = document.createElement('span');
        cursor.className = 'terminal-editor-cursor';
        cursor.textContent = ' ';
        content.append(cursor);
      } else if (!text.length) {
        content.append(document.createTextNode(' '));
      }
      if (this.isNewlineSelected(index, text.length)) {
        const newline = document.createElement('span');
        newline.className = 'terminal-editor-selection';
        newline.textContent = ' ';
        content.append(newline);
      }
      line.append(gutter, content);
      body.append(line);
    });
    requestAnimationFrame(() => {
      body.querySelector('.terminal-editor-cursor')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  private renderHelp() {
    if (!this.state) return;
    this.state.body.replaceChildren();
    const help = document.createElement('pre');
    help.className = 'terminal-editor-help';
    help.textContent = [
      'NANO HELP',
      '',
      'Typing inserts text at the cursor. Enter creates a line.',
      'Arrow keys              Move the cursor',
      'Shift + navigation      Select text across characters and lines',
      'Home/End or Ctrl+A/E    Start/end of line',
      'Page Up/Page Down       Move ten lines',
      'Backspace/Delete        Delete text or join lines',
      'Ctrl+S or Ctrl+O        Save the current file',
      'Ctrl+X                  Exit; modified files ask whether to save',
      'Ctrl+W                  Search forward, wrapping at end of file',
      'Ctrl+K / Ctrl+U         Cut current line / paste cut line',
      'Ctrl+C              Copy selected text',
      'Ctrl+X              Cut selection; Ctrl+X exits without one',
      'Cmd+A / Ctrl+Shift+A    Select the entire buffer',
      'Ctrl+Z / Ctrl+Y         Undo / redo',
      'Mouse/touch             Place the cursor, drag to select, Shift-click to extend',
      '',
      'Press Q, Esc, or Ctrl+G to return to the editor.'
    ].join('\n');
    this.state.body.append(help);
  }

  private handleSearchKey(event: KeyboardEvent) {
    if (!this.state) return;
    const key = event.key.toLowerCase();
    if (event.key === 'Enter') {
      this.searchNext();
      this.state.mode = 'edit';
    } else if (event.key === 'Escape' || (event.ctrlKey && key === 'c')) {
      this.state.mode = 'edit';
      this.state.status = 'Search cancelled';
    } else if (event.key === 'Backspace') {
      this.state.prompt = this.state.prompt.slice(0, -1);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.state.prompt += event.key;
    }
    this.render();
  }

  private handleSaveAsKey(event: KeyboardEvent) {
    if (!this.state) return;
    const key = event.key.toLowerCase();
    if (event.key === 'Enter') {
      this.prepareSaveAs();
      return;
    }
    if (event.key === 'Escape' || (event.ctrlKey && key === 'c')) {
      this.cancelSaveAs();
      return;
    }
    if (event.key === 'Backspace') this.state.prompt = this.state.prompt.slice(0, -1);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) this.state.prompt += event.key;
    this.state.status = '';
    this.render();
  }

  private prepareSaveAs() {
    if (!this.state) return;
    const displayName = this.state.prompt.trim();
    if (!displayName) {
      this.state.status = 'File name cannot be empty';
      this.render();
      return;
    }
    const filePath = this.options.fileSystem.normalize(displayName);
    if (this.options.fileSystem.directories[filePath]) {
      this.state.status = 'Is a directory';
      this.render();
      return;
    }
    if (!this.options.fileSystem.directories[this.options.fileSystem.dirname(filePath)]) {
      this.state.status = 'No such directory';
      this.render();
      return;
    }
    if (!this.options.fileSystem.files[filePath]
      && this.options.fileSystem.isReadOnly(this.options.fileSystem.dirname(filePath))) {
      this.state.status = 'Permission denied: read-only directory';
      this.render();
      return;
    }
    if (this.options.fileSystem.isReadOnly(filePath)) {
      this.state.status = 'Permission denied: read-only file';
      this.render();
      return;
    }
    this.state.pendingFilePath = filePath;
    if (this.options.fileSystem.files[filePath]) {
      this.state.mode = 'confirm-overwrite';
      this.render();
      return;
    }
    this.commitSaveAs();
  }

  private commitSaveAs() {
    if (!this.state?.pendingFilePath) return;
    this.state.filePath = this.state.pendingFilePath;
    this.state.displayName = this.state.prompt.trim();
    this.state.pendingFilePath = null;
    this.state.mode = 'edit';
    const closeAfterSave = this.state.closeAfterSave;
    this.state.closeAfterSave = false;
    if (this.save() && closeAfterSave) this.close();
    else this.render();
  }

  private cancelSaveAs() {
    if (!this.state) return;
    this.state.mode = 'edit';
    this.state.pendingFilePath = null;
    this.state.closeAfterSave = false;
    this.state.status = 'Write cancelled';
    this.render();
  }

  private searchNext() {
    if (!this.state || !this.state.prompt) return;
    const query = this.state.prompt.toLocaleLowerCase();
    for (let offset = 0; offset <= this.state.lines.length; offset += 1) {
      const row = (this.state.row + offset) % this.state.lines.length;
      const line = this.state.lines[row].toLocaleLowerCase();
      const from = offset === 0 ? this.state.column + 1 : 0;
      const column = line.indexOf(query, from);
      if (column >= 0) {
        this.state.row = row;
        this.state.column = column;
        this.state.preferredColumn = null;
        this.state.status = `Found '${this.state.prompt}'`;
        return;
      }
    }
    this.state.status = `Not found: ${this.state.prompt}`;
  }

  private currentLine() {
    return this.state?.lines[this.state.row] ?? '';
  }

  private currentPosition(): EditorPosition {
    return { row: this.state?.row ?? 0, column: this.state?.column ?? 0 };
  }

  private comparePositions(left: EditorPosition, right: EditorPosition) {
    return left.row === right.row ? left.column - right.column : left.row - right.row;
  }

  private selectionRange(): { start: EditorPosition; end: EditorPosition } | null {
    if (!this.state?.selectionAnchor) return null;
    const cursor = this.currentPosition();
    if (this.comparePositions(this.state.selectionAnchor, cursor) === 0) return null;
    return this.comparePositions(this.state.selectionAnchor, cursor) < 0
      ? { start: this.state.selectionAnchor, end: cursor }
      : { start: cursor, end: this.state.selectionAnchor };
  }

  private hasSelection() {
    return Boolean(this.selectionRange());
  }

  private isCharacterSelected(row: number, column: number) {
    const range = this.selectionRange();
    if (!range) return false;
    const position = { row, column };
    return this.comparePositions(range.start, position) <= 0
      && this.comparePositions(position, range.end) < 0;
  }

  private isNewlineSelected(row: number, column: number) {
    const range = this.selectionRange();
    if (!range || row >= range.end.row) return false;
    return this.comparePositions(range.start, { row, column }) <= 0;
  }

  private selectedText() {
    if (!this.state) return '';
    const range = this.selectionRange();
    if (!range) return '';
    if (range.start.row === range.end.row) {
      return this.state.lines[range.start.row].slice(range.start.column, range.end.column);
    }
    return [
      this.state.lines[range.start.row].slice(range.start.column),
      ...this.state.lines.slice(range.start.row + 1, range.end.row),
      this.state.lines[range.end.row].slice(0, range.end.column)
    ].join('\n');
  }

  private deleteSelection(record = true) {
    if (!this.state) return false;
    const range = this.selectionRange();
    if (!range) return false;
    if (record) this.recordUndo();
    const first = this.state.lines[range.start.row].slice(0, range.start.column);
    const last = this.state.lines[range.end.row].slice(range.end.column);
    this.state.lines.splice(range.start.row, range.end.row - range.start.row + 1, first + last);
    this.state.row = range.start.row;
    this.state.column = range.start.column;
    this.state.selectionAnchor = null;
    return true;
  }

  private copySelection() {
    if (!this.state) return;
    const text = this.selectedText();
    if (!text) {
      this.state.status = 'No text selected';
      return;
    }
    this.state.cutBuffer = text.split('\n');
    this.state.status = `Copied ${text.length} character${text.length === 1 ? '' : 's'}`;
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  private cutSelection() {
    if (!this.state) return;
    const text = this.selectedText();
    if (!text) return;
    this.recordUndo();
    this.state.cutBuffer = text.split('\n');
    this.deleteSelection(false);
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    this.afterEdit(`Cut ${text.length} character${text.length === 1 ? '' : 's'}`);
  }

  private selectAll() {
    if (!this.state) return;
    this.state.selectionAnchor = { row: 0, column: 0 };
    this.state.row = this.state.lines.length - 1;
    this.state.column = this.currentLine().length;
    this.state.preferredColumn = null;
    this.state.status = 'Selected all';
  }

  private recordUndo() {
    if (!this.state) return;
    this.state.undo.push({ lines: [...this.state.lines], row: this.state.row, column: this.state.column });
    if (this.state.undo.length > maxUndoDepth) this.state.undo.shift();
    this.state.redo = [];
  }

  private restoreSnapshot(snapshot: EditorSnapshot) {
    if (!this.state) return;
    this.state.lines = [...snapshot.lines];
    this.state.row = snapshot.row;
    this.state.column = snapshot.column;
    this.state.preferredColumn = null;
    this.state.selectionAnchor = null;
    this.updateDirty();
  }

  private undo() {
    if (!this.state) return;
    const snapshot = this.state.undo.pop();
    if (!snapshot) {
      this.state.status = 'Nothing to undo';
      return;
    }
    this.state.redo.push({ lines: [...this.state.lines], row: this.state.row, column: this.state.column });
    this.restoreSnapshot(snapshot);
    this.state.status = 'Undid edit';
  }

  private redo() {
    if (!this.state) return;
    const snapshot = this.state.redo.pop();
    if (!snapshot) {
      this.state.status = 'Nothing to redo';
      return;
    }
    this.state.undo.push({ lines: [...this.state.lines], row: this.state.row, column: this.state.column });
    this.restoreSnapshot(snapshot);
    this.state.status = 'Redid edit';
  }

  private insertText(value: string) {
    if (!this.state) return;
    this.recordUndo();
    this.deleteSelection(false);
    const line = this.currentLine();
    this.state.lines[this.state.row] = line.slice(0, this.state.column) + value + line.slice(this.state.column);
    this.state.column += value.length;
    this.afterEdit();
  }

  private insertNewline() {
    if (!this.state) return;
    this.recordUndo();
    this.deleteSelection(false);
    const line = this.currentLine();
    this.state.lines.splice(this.state.row, 1, line.slice(0, this.state.column), line.slice(this.state.column));
    this.state.row += 1;
    this.state.column = 0;
    this.afterEdit();
  }

  private insertPastedText(value: string) {
    if (!this.state) return;
    this.recordUndo();
    this.deleteSelection(false);
    const pasted = value.replace(/\r\n?/g, '\n').split('\n');
    const line = this.currentLine();
    const before = line.slice(0, this.state.column);
    const after = line.slice(this.state.column);
    if (pasted.length === 1) {
      this.state.lines[this.state.row] = before + pasted[0] + after;
      this.state.column += pasted[0].length;
    } else {
      const replacement = [
        before + pasted[0],
        ...pasted.slice(1, -1),
        pasted.at(-1)! + after
      ];
      this.state.lines.splice(this.state.row, 1, ...replacement);
      this.state.row += replacement.length - 1;
      this.state.column = pasted.at(-1)!.length;
    }
    this.afterEdit(`Pasted ${pasted.length} line${pasted.length === 1 ? '' : 's'}`);
  }

  private backspace() {
    if (!this.state) return;
    if (this.hasSelection()) {
      this.recordUndo();
      this.deleteSelection(false);
      this.afterEdit();
      return;
    }
    if (this.state.column > 0) {
      this.recordUndo();
      const line = this.currentLine();
      this.state.lines[this.state.row] = line.slice(0, this.state.column - 1) + line.slice(this.state.column);
      this.state.column -= 1;
      this.afterEdit();
    } else if (this.state.row > 0) {
      this.recordUndo();
      const previous = this.state.lines[this.state.row - 1];
      this.state.column = previous.length;
      this.state.lines.splice(this.state.row - 1, 2, previous + this.currentLine());
      this.state.row -= 1;
      this.afterEdit();
    }
  }

  private deleteForward() {
    if (!this.state) return;
    if (this.hasSelection()) {
      this.recordUndo();
      this.deleteSelection(false);
      this.afterEdit();
      return;
    }
    const line = this.currentLine();
    if (this.state.column < line.length) {
      this.recordUndo();
      this.state.lines[this.state.row] = line.slice(0, this.state.column) + line.slice(this.state.column + 1);
      this.afterEdit();
    } else if (this.state.row < this.state.lines.length - 1) {
      this.recordUndo();
      this.state.lines.splice(this.state.row, 2, line + this.state.lines[this.state.row + 1]);
      this.afterEdit();
    }
  }

  private cutLine() {
    if (!this.state) return;
    if (this.hasSelection()) {
      this.cutSelection();
      return;
    }
    this.recordUndo();
    this.state.cutBuffer = [this.currentLine()];
    if (this.state.lines.length === 1) this.state.lines[0] = '';
    else {
      this.state.lines.splice(this.state.row, 1);
      this.state.row = Math.min(this.state.row, this.state.lines.length - 1);
    }
    this.state.column = 0;
    this.afterEdit('Cut one line');
  }

  private pasteCutBuffer() {
    if (!this.state) return;
    if (!this.state.cutBuffer.length) {
      this.state.status = 'Cut buffer is empty';
      return;
    }
    this.recordUndo();
    const replacedSelection = this.deleteSelection(false);
    if (!replacedSelection && this.state.lines.length === 1 && this.state.lines[0] === '') {
      this.state.lines = [...this.state.cutBuffer];
      this.state.row = this.state.cutBuffer.length - 1;
      this.state.column = this.currentLine().length;
    } else {
      const value = this.state.cutBuffer.join('\n');
      const pasted = value.split('\n');
      const line = this.currentLine();
      const before = line.slice(0, this.state.column);
      const after = line.slice(this.state.column);
      if (pasted.length === 1) {
        this.state.lines[this.state.row] = before + pasted[0] + after;
        this.state.column += pasted[0].length;
      } else {
        this.state.lines.splice(this.state.row, 1, before + pasted[0], ...pasted.slice(1, -1), pasted.at(-1)! + after);
        this.state.row += pasted.length - 1;
        this.state.column = pasted.at(-1)!.length;
      }
    }
    this.afterEdit(`Pasted ${this.state.cutBuffer.length} line${this.state.cutBuffer.length === 1 ? '' : 's'}`);
  }

  private prepareSelection(extend: boolean) {
    if (!this.state) return;
    if (extend) this.state.selectionAnchor ??= this.currentPosition();
    else this.state.selectionAnchor = null;
  }

  private moveHorizontal(direction: -1 | 1, extend = false) {
    if (!this.state) return;
    const range = this.selectionRange();
    if (range && !extend) {
      const target = direction < 0 ? range.start : range.end;
      this.state.row = target.row;
      this.state.column = target.column;
      this.state.selectionAnchor = null;
      this.state.preferredColumn = null;
      this.state.status = '';
      return;
    }
    this.prepareSelection(extend);
    if (direction < 0) {
      if (this.state.column > 0) this.state.column -= 1;
      else if (this.state.row > 0) {
        this.state.row -= 1;
        this.state.column = this.currentLine().length;
      }
    } else if (this.state.column < this.currentLine().length) this.state.column += 1;
    else if (this.state.row < this.state.lines.length - 1) {
      this.state.row += 1;
      this.state.column = 0;
    }
    this.state.preferredColumn = null;
    this.state.status = '';
  }

  private moveVertical(amount: number, extend = false) {
    if (!this.state) return;
    this.prepareSelection(extend);
    const preferred = this.state.preferredColumn ?? this.state.column;
    this.state.row = Math.max(0, Math.min(this.state.lines.length - 1, this.state.row + amount));
    this.state.column = Math.min(preferred, this.currentLine().length);
    this.state.preferredColumn = preferred;
    this.state.status = '';
  }

  private moveToColumn(column: number, extend = false) {
    if (!this.state) return;
    this.prepareSelection(extend);
    this.state.column = column;
    this.state.preferredColumn = null;
    this.state.status = '';
  }

  private afterEdit(status = '') {
    if (!this.state) return;
    this.state.preferredColumn = null;
    this.state.selectionAnchor = null;
    this.state.status = status;
    this.updateDirty();
  }

  private updateDirty() {
    if (this.state) this.state.dirty = serialize(this.state.lines) !== this.state.savedContent;
  }

  private requestSave(closeAfterSave: boolean) {
    if (!this.state) return;
    if (!this.state.filePath) {
      this.state.mode = 'save-as';
      this.state.prompt = '';
      this.state.status = '';
      this.state.closeAfterSave = closeAfterSave;
      this.render();
      return;
    }
    if (this.save() && closeAfterSave) this.close();
  }

  private save() {
    if (!this.state?.filePath) return false;
    const lines = this.state.lines.length === 1 && this.state.lines[0] === '' ? [] : this.state.lines;
    if (!this.options.fileSystem.writeFile(this.state.filePath, lines)) {
      this.state.status = 'Error writing file';
      return false;
    }
    this.options.persist();
    this.state.savedContent = serialize(this.state.lines);
    this.state.dirty = false;
    this.state.status = `Wrote ${lines.length} line${lines.length === 1 ? '' : 's'}`;
    return true;
  }

  private requestClose() {
    if (!this.state) return;
    if (this.state.dirty) {
      this.state.mode = 'confirm-exit';
      this.render();
    } else this.close();
  }

  private close() {
    if (!this.state) return;
    this.state.body.removeEventListener('pointerdown', this.handlePointerDown);
    this.state.body.removeEventListener('pointermove', this.handlePointerMove);
    this.state.body.removeEventListener('pointerup', this.handlePointerUp);
    this.state.screen.remove();
    this.state = null;
    this.options.onClose();
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.state || this.state.mode !== 'edit') return;
    const position = this.positionFromPointer(event);
    if (!position) return;
    const previous = this.currentPosition();
    this.pointerAnchor = event.shiftKey ? (this.state.selectionAnchor ?? previous) : position;
    this.state.selectionAnchor = event.shiftKey ? this.pointerAnchor : null;
    this.state.row = position.row;
    this.state.column = position.column;
    this.state.preferredColumn = null;
    this.state.status = '';
    this.state.body.setPointerCapture?.(event.pointerId);
    this.render();
    this.options.input.focus({ preventScroll: true });
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.state || !this.pointerAnchor || !(event.buttons & 1)) return;
    const position = this.positionFromPointer(event);
    if (!position) return;
    this.state.selectionAnchor = this.pointerAnchor;
    this.state.row = position.row;
    this.state.column = position.column;
    this.state.preferredColumn = null;
    this.render();
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.state) return;
    if (!this.hasSelection()) this.state.selectionAnchor = null;
    this.pointerAnchor = null;
    this.state.body.releasePointerCapture?.(event.pointerId);
  };

  private positionFromPointer(event: PointerEvent): EditorPosition | null {
    if (!this.state) return null;
    const element = document.elementFromPoint(event.clientX, event.clientY)
      ?? (event.target instanceof Element ? event.target : null);
    const target = element?.closest<HTMLElement>('[data-editor-row]') ?? null;
    if (!target) return null;
    const row = Number(target.dataset.editorRow);
    const content = target.querySelector<HTMLElement>('.terminal-editor-content');
    if (!Number.isInteger(row) || !content) return null;
    const fontSize = Number.parseFloat(getComputedStyle(content).fontSize) || 16;
    const column = Math.round((event.clientX - content.getBoundingClientRect().left) / (fontSize * 0.602));
    const safeRow = Math.max(0, Math.min(this.state.lines.length - 1, row));
    return {
      row: safeRow,
      column: Math.max(0, Math.min(this.state.lines[safeRow].length, column))
    };
  }
}
