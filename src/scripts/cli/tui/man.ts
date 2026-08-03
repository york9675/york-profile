import { cliConfig } from '../config';
import type { CommandDefinition } from '../commands';

interface ManTuiOptions {
  root: HTMLElement;
  input: HTMLInputElement;
  updateInput: () => void;
  scrollTerminalToBottom: () => void;
}

interface ManState {
  screen: HTMLElement;
  document: HTMLElement;
  status: HTMLElement;
  command: CommandDefinition;
}

export class ManTuiApp {
  private state: ManState | null = null;

  constructor(private readonly options: ManTuiOptions) {}

  open(command: CommandDefinition) {
    this.close();
    const screen = document.createElement('section');
    screen.className = 'terminal-man-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-label', `${command.name} manual`);

    const documentNode = document.createElement('div');
    documentNode.className = 'terminal-man-document';
    const title = command.name.toUpperCase();
    documentNode.textContent = [
      `${title}(1)                 ${cliConfig.name} Manual                 ${title}(1)`,
      '',
      'NAME',
      `    ${command.name} — ${command.description}`,
      '',
      'SYNOPSIS',
      `    ${command.usage}`,
      '',
      'DESCRIPTION',
      `    ${command.manual}`,
      '',
      'KEYS',
      '    Up/Down or J/K    scroll one line',
      '    Page Up/Down      scroll one screen',
      '    Home/End          jump to start or end',
      '    Q or Esc          quit manual',
      '',
      'AUTHOR',
      '    York Development'
    ].join('\n');

    const status = document.createElement('div');
    status.className = 'terminal-man-status';
    screen.append(documentNode, status);
    this.state = { screen, document: documentNode, status, command };
    screen.addEventListener('wheel', this.handleWheel, { passive: false });
    documentNode.addEventListener('scroll', this.updateStatus);
    this.options.root.append(screen);
    this.updateStatus();
    this.options.input.focus({ preventScroll: true });
  }

  handleKey(event: KeyboardEvent) {
    if (!this.state) return false;
    event.preventDefault();
    const key = event.key.toLowerCase();
    if (key === 'q' || event.key === 'Escape' || (event.ctrlKey && key === 'c')) {
      this.close();
      return true;
    }
    if (event.key === 'ArrowUp' || key === 'k') this.scrollLines(-1);
    else if (event.key === 'ArrowDown' || key === 'j' || event.key === 'Enter') this.scrollLines(1);
    else if (event.key === 'PageUp') this.scrollPages(-1);
    else if (event.key === 'PageDown' || event.key === ' ') this.scrollPages(1);
    else if (event.key === 'Home') this.state.document.scrollTop = 0;
    else if (event.key === 'End') this.state.document.scrollTop = this.state.document.scrollHeight;
    this.updateStatus();
    return true;
  }

  private close() {
    if (!this.state) return;
    this.state.screen.removeEventListener('wheel', this.handleWheel);
    this.state.document.removeEventListener('scroll', this.updateStatus);
    this.state.screen.remove();
    this.state = null;
    this.options.updateInput();
    this.options.input.focus({ preventScroll: true });
    this.options.scrollTerminalToBottom();
  }

  private lineHeight() {
    if (!this.state) return 20;
    return Number.parseFloat(getComputedStyle(this.state.document).lineHeight) || 20;
  }

  private scrollLines(lines: number) {
    if (!this.state) return;
    this.state.document.scrollTop += lines * this.lineHeight();
  }

  private scrollPages(pages: number) {
    if (!this.state) return;
    this.state.document.scrollTop += pages * Math.max(this.lineHeight(), this.state.document.clientHeight - this.lineHeight());
  }

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.scrollLines(Math.sign(event.deltaY));
    this.updateStatus();
  };

  private updateStatus = () => {
    if (!this.state) return;
    const lineHeight = this.lineHeight();
    const currentLine = Math.floor(this.state.document.scrollTop / lineHeight) + 1;
    const atEnd = this.state.document.scrollTop + this.state.document.clientHeight >= this.state.document.scrollHeight - 1;
    this.state.status.textContent = `${this.state.command.name}(1)  line ${currentLine}${atEnd ? '  (END)' : ''}  ·  Q to quit`;
  };
}
