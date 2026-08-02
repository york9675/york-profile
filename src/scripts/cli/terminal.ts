import { commandNames } from './config';
import { VirtualFileSystem } from './filesystem';
import { cleanToken } from './parser';
import type { Completion, Segment, Tone } from './types';

interface TerminalElements {
  screen: HTMLElement;
  output: HTMLElement;
  input: HTMLInputElement;
  prompt: HTMLElement;
  highlight: HTMLElement;
  cursor: HTMLElement;
}

export function segment(text: string, tone?: Tone, href?: string): Segment {
  return { text, tone, href };
}

export class TerminalView {
  private ghostCompletion: { completion: Completion; candidate: string } | null = null;

  constructor(
    private readonly elements: TerminalElements,
    private readonly fileSystem: VirtualFileSystem,
    private readonly isPasswordPrompt: () => boolean
  ) {}

  appendLine = (
    content = '',
    options: { tone?: Tone; spaced?: boolean; command?: boolean } = {}
  ) => {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    if (options.tone) line.classList.add(`terminal-${options.tone}`);
    if (options.spaced) line.classList.add('terminal-line-spaced');
    if (options.command) line.classList.add('terminal-command-line');
    line.textContent = content;
    this.elements.output.append(line);
    return line;
  };

  appendSegments = (segments: Segment[], options: { spaced?: boolean } = {}) => {
    const line = this.appendLine('', options);
    for (const item of segments) {
      const node = item.href ? document.createElement('a') : document.createElement('span');
      node.textContent = item.text;
      if (item.tone) node.classList.add(`terminal-${item.tone}`);
      if (item.href && node instanceof HTMLAnchorElement) {
        node.href = item.href;
        if (item.href.startsWith('http')) {
          node.target = '_blank';
          node.rel = 'noopener noreferrer';
        }
      }
      line.append(node);
    }
    return line;
  };

  appendCommandLine = (value: string, suffix = '') => {
    const line = this.appendLine('', { command: true });
    const promptNode = document.createElement('span');
    promptNode.className = 'terminal-accent';
    promptNode.textContent = this.elements.prompt.textContent;
    const commandNode = document.createElement('span');
    this.renderSyntax(commandNode, value);
    line.append(promptNode, commandNode, suffix);
  };

  getCompletion = (cursor = this.elements.input.selectionStart ?? this.elements.input.value.length): Completion | null => {
    const before = this.elements.input.value.slice(0, cursor);
    const tokenMatch = before.match(/(?:^|\s)([^\s]*)$/);
    const token = tokenMatch?.[1] ?? '';
    const start = cursor - token.length;
    const commandPosition = before.trimStart() === token;
    let candidates: string[];

    if (commandPosition) {
      candidates = commandNames.filter(name => name.startsWith(token));
    } else {
      const slashIndex = token.lastIndexOf('/');
      const parentInput = slashIndex >= 0 ? token.slice(0, slashIndex + 1) : '';
      const partial = slashIndex >= 0 ? token.slice(slashIndex + 1) : token;
      const parentPath = this.fileSystem.normalize(parentInput || '.');
      candidates = (this.fileSystem.directories[parentPath] ?? [])
        .filter(name => name.startsWith(partial))
        .map(name => {
          const path = this.fileSystem.normalize(`${parentPath}/${name}`);
          return `${parentInput}${name}${this.fileSystem.directories[path] ? '/' : ''}`;
        });
    }

    return candidates.length ? { start, end: cursor, token, candidates } : null;
  };

  acceptGhostCompletion = () => {
    if (!this.ghostCompletion) return false;
    const { completion, candidate } = this.ghostCompletion;
    this.elements.input.value = this.elements.input.value.slice(0, completion.start)
      + candidate
      + this.elements.input.value.slice(completion.end);
    this.setCursor(completion.start + candidate.length);
    return true;
  };

  updateInput = () => {
    const { input, cursor, highlight } = this.elements;
    const position = input.selectionStart ?? input.value.length;
    if (this.isPasswordPrompt()) {
      cursor.hidden = true;
      this.ghostCompletion = null;
      highlight.textContent = '⚿';
      highlight.style.transform = 'none';
      return;
    }
    cursor.hidden = false;
    const hasSelection = position !== (input.selectionEnd ?? position);
    const completion = position === input.value.length && !hasSelection && input.value.length
      ? this.getCompletion(position)
      : null;
    const candidate = completion?.token
      ? completion.candidates.find(item => item !== completion.token)
      : undefined;
    this.ghostCompletion = completion && candidate ? { completion, candidate } : null;
    this.renderSyntax(highlight, input.value, true);
    highlight.style.transform = `translateX(${-input.scrollLeft}px)`;
    const ghostCharacter = this.ghostCompletion?.candidate[this.ghostCompletion.completion.token.length];
    cursor.textContent = input.value[position] ?? ghostCharacter ?? ' ';
    cursor.style.transform = `translateX(calc(${position}ch - ${input.scrollLeft}px))`;
  };

  scrollToBottom = () => {
    requestAnimationFrame(() => {
      this.elements.screen.scrollTop = this.elements.screen.scrollHeight;
    });
  };

  private setCursor(position: number) {
    this.elements.input.setSelectionRange(position, position);
    this.updateInput();
  }

  private renderSyntax(container: HTMLElement, value: string, showGhost = false) {
    container.replaceChildren();
    let foundCommand = false;

    for (const part of value.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        container.append(document.createTextNode(part));
        continue;
      }

      const token = document.createElement('span');
      token.textContent = part;
      if (!foundCommand) {
        foundCommand = true;
        token.className = commandNames.includes(cleanToken(part))
          ? 'terminal-command-valid'
          : 'terminal-command-invalid';
      } else if (!part.startsWith('-')) {
        const path = this.fileSystem.normalize(cleanToken(part));
        if (this.fileSystem.files[path]) token.className = 'terminal-path-valid';
        else if (this.fileSystem.directories[path]) token.className = 'terminal-directory-valid';
      }
      container.append(token);
    }

    if (showGhost && this.ghostCompletion) {
      const suffix = this.ghostCompletion.candidate.slice(this.ghostCompletion.completion.token.length);
      if (suffix) {
        const ghost = document.createElement('span');
        ghost.className = 'terminal-completion-ghost';
        ghost.textContent = suffix;
        container.append(ghost);
      }
    }
  }
}
