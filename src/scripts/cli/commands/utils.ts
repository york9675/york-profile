import type { TerminalView } from '../terminal';

export async function withLoadingStatus<T>(
  terminal: TerminalView,
  message: string,
  load: () => Promise<T>
): Promise<T> {
  const status = terminal.appendLine(message, { tone: 'muted' });
  terminal.scrollToBottom();
  try {
    return await load();
  } finally {
    status.remove();
    terminal.scrollToBottom();
  }
}
