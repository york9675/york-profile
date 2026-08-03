import type { ParsedCommand } from './types';

export function tokenize(value: string): ParsedCommand | { error: string } {
  const tokens: string[] = [];
  let token = '';
  let quote: 'single' | 'double' | null = null;
  let escaped = false;

  for (const char of value.trim()) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote !== 'single') {
      escaped = true;
      continue;
    }
    if (char === "'" && quote !== 'double') {
      quote = quote === 'single' ? null : 'single';
      continue;
    }
    if (char === '"' && quote !== 'single') {
      quote = quote === 'double' ? null : 'double';
      continue;
    }
    if (/\s/.test(char) && !quote) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }
    token += char;
  }

  if (escaped) token += '\\';
  if (quote) return { error: 'syntax error: unmatched quote' };
  if (token) tokens.push(token);
  return { command: tokens[0] ?? '', args: tokens.slice(1) };
}

export function cleanToken(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
