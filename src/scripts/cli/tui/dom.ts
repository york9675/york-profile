export function appendTuiLine(container: HTMLElement, text = '', className?: string) {
  const line = document.createElement('div');
  line.className = `terminal-settings-line${className ? ` ${className}` : ''}`;
  line.textContent = text;
  container.append(line);
  return line;
}
