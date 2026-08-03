import { topTasks } from '../config';
import { getHeapSummary } from '../system';
import type { Tone, TopTuiState } from '../types';
import { appendTuiLine } from './dom';

interface TopTuiOptions {
  root: HTMLElement;
  input: HTMLInputElement;
  getUsername: () => string;
  appendLine: (content: string, options?: { tone?: Tone }) => HTMLElement;
  updateInput: () => void;
  scrollToBottom: () => void;
}

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export class TopTuiApp {
  private state: TopTuiState | null = null;

  constructor(private readonly options: TopTuiOptions) {}

  open() {
    if (this.state) return;
    const screen = document.createElement('section');
    screen.className = 'terminal-settings-screen terminal-top-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-label', 'Task monitor');
    this.state = {
      screen,
      selected: 0,
      paused: false,
      showDetails: false,
      tick: 0,
      intervalId: 0
    };
    this.options.root.append(screen);
    this.render();
    this.state.intervalId = window.setInterval(() => {
      if (!this.state || this.state.paused) return;
      this.state.tick += 1;
      this.render();
    }, 1000);
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
    if (event.key === 'ArrowUp' || key === 'k') {
      this.state.selected = Math.max(0, this.state.selected - 1);
      this.state.showDetails = false;
    } else if (event.key === 'ArrowDown' || key === 'j') {
      this.state.selected = Math.min(topTasks.length - 1, this.state.selected + 1);
      this.state.showDetails = false;
    } else if (event.key === 'Enter') {
      this.state.showDetails = !this.state.showDetails;
    } else if (event.key === ' ') {
      this.state.paused = !this.state.paused;
    }
    this.render();
    return true;
  }

  private close() {
    if (!this.state) return;
    window.clearInterval(this.state.intervalId);
    this.state.screen.remove();
    this.state = null;
    this.options.appendLine('top exited', { tone: 'muted' });
    this.options.updateInput();
    this.options.input.focus({ preventScroll: true });
    this.options.scrollToBottom();
  }

  private render() {
    if (!this.state) return;
    const { screen, paused, selected, showDetails, tick } = this.state;
    const now = new Date();
    const uptime = Math.floor(performance.now() / 1000);
    const cpuValues = topTasks.map((task, index) => (
      Math.max(0.1, task.cpu * (0.48 + Math.abs(Math.sin((tick + index * 1.7) / 3)))).toFixed(1)
    ));

    screen.replaceChildren();
    appendTuiLine(
      screen,
      `Top  ${now.toLocaleTimeString()}  up ${formatTime(uptime)}  1 user${paused ? '  [PAUSED]' : ''}`,
      'terminal-settings-title'
    );
    appendTuiLine(screen, `Tasks: ${topTasks.length} total, 1 running, ${topTasks.length - 1} sleeping`);
    appendTuiLine(screen, `JS heap: ${getHeapSummary()}`);
    appendTuiLine(screen, '────────────────────────────────────────────────────────────────────────');
    appendTuiLine(screen, '  PID USER         STATE       CPU%   MEM%   TIME      COMMAND', 'terminal-top-heading');

    topTasks.forEach((task, index) => {
      const isSelected = selected === index;
      const elapsed = formatTime(Math.floor(uptime * Number(cpuValues[index]) / 100));
      appendTuiLine(
        screen,
        `${isSelected ? '>' : ' '} ${String(task.pid).padStart(4)} ${this.options.getUsername().slice(0, 12).padEnd(12)} ${task.state.padEnd(10)} ${cpuValues[index].padStart(5)}  ${task.memory.toFixed(1).padStart(5)}  ${elapsed}  ${task.command}`,
        isSelected ? 'is-selected terminal-top-process' : 'terminal-top-process'
      );
    });

    if (showDetails) {
      const task = topTasks[selected];
      appendTuiLine(screen);
      appendTuiLine(screen, `PID ${task.pid} · ${task.description}`, 'terminal-top-details');
    }
    appendTuiLine(screen);
    appendTuiLine(screen, 'Up/Down or J/K · select    Enter · details    Space · pause    Q or Esc · quit', 'terminal-settings-keys');
  }
}
