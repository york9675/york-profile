# Command development

[← Documentation table of contents](./cli-development.md)

## Table of Contents

- [Create a command](#create-a-command)
- [Register the command](#register-the-command)
- [Arguments and options](#arguments-and-options)
- [Argument completion](#argument-completion)
- [Asynchronous commands](#asynchronous-commands)
- [Command checklist](#command-checklist)

## Create a command

Create `src/scripts/cli/commands/<name>.ts`. Each file exports one `CommandDefinition`:

```ts
import type { CommandDefinition } from './types';

export const uptimeCommand: CommandDefinition = {
  name: 'uptime',
  usage: 'uptime [-h]',
  description: 'show how long this CLI page has been open',
  manual: 'Print the time elapsed since the current page loaded.',
  execute: ({ terminal }) => {
    const seconds = Math.max(1, Math.floor(performance.now() / 1000));
    terminal.appendLine(`up ${seconds} seconds`);
  }
};
```

The definition fields are:

| Field | Purpose |
| --- | --- |
| `name` | Exact command entered by the user. |
| `usage` | Synopsis used by `-h`, `help`, and `man`. Include `[-h]`. |
| `description` | Short text shown by `help` and the manual's NAME section. |
| `manual` | Longer explanation shown by the fullscreen `man` pager. |
| `completion` | Optional argument completion kind, fixed value list, or resolver. |
| `isOptionAllowed` | Optional validator for arguments beginning with `-`. |
| `execute` | Synchronous or asynchronous implementation. |

The runtime APIs available to `execute` are documented in the [runtime API reference](./runtime-api.md).

## Register the command

Import the command in `commands/index.ts` and add it to `commands`:

```ts
import { uptimeCommand } from './uptime';

export const commands = [
  // Existing commands...
  uptimeCommand
] as const;
```

Registration automatically provides:

- valid-command syntax highlighting;
- command-name autocomplete;
- inclusion in `help`;
- centralized `-h` and `--help` handling;
- lookup by `man`;
- normal command-not-found behavior for everything else.

Do not create another command-name, usage, help, or manual registry.

## Arguments and options

`parser.ts` supports whitespace, single and double quotes, and backslash escaping. `execute` receives parsed arguments without the command name.

`-h` and `--help` are handled centrally before `execute` runs. Do not add them to `isOptionAllowed`.

Every other argument beginning with `-` is rejected unless the command explicitly accepts it:

```ts
isOptionAllowed: option => option === '-l' || option === '--list'
```

Combined short options can use a regular expression when appropriate:

```ts
isOptionAllowed: option => /^-[in]+$/.test(option)
```

Validate missing operands, extra operands, paths, names, and URLs inside the command. Prefer familiar Unix-style errors and the `error` tone. Never reinterpret an unknown option as a filename.

## Argument completion

Declare completion in the command definition instead of adding command-specific branches to `terminal.ts`.

| Completion | Behavior |
| --- | --- |
| `'none'` or omitted | Do not suggest arguments. |
| `'directory'` | Suggest directories only. Use for `cd`, `ls`, and other directory-only operands. |
| `'file'` | Suggest files and directories needed to traverse toward a file. |
| `'path'` | Suggest either files or directories. |
| `'command'` | Suggest registered command names. |
| `{ values }` | Suggest a fixed shared list of accepted values. |

Examples:

```ts
completion: 'directory'
```

```ts
completion: { values: themes }
```

A resolver receives arguments before the token currently being completed, so behavior can change by position:

```ts
completion: args => args.some(arg => !arg.startsWith('-')) ? 'file' : 'none'
```

File completion intentionally includes directories for path traversal. Directory completion never includes files.

## Asynchronous commands

Declare `execute` as `async` and return its promise. The shell hides and disables the prompt, sets `aria-busy`, and restores input only after that promise settles.

Use the shared loading helper when one removable status line is enough:

```ts
import { withLoadingStatus } from './utils';

execute: async ({ terminal }) => {
  try {
    const data = await withLoadingStatus(
      terminal,
      'example: fetching...',
      fetchExample
    );
    terminal.appendLine(data.value);
  } catch {
    terminal.appendLine('example: request failed', { tone: 'error' });
  }
}
```

Rules for remote work:

- Return the real promise; do not launch an untracked promise with `void`.
- Show loading feedback before the first `await`.
- Remove or replace loading feedback on both success and failure.
- Check `response.ok` and validate response fields.
- Put reusable fetching, caching, and response types in `services/`.
- Do not manually render another command prompt.

## Command checklist

- The command has its own file and is registered once.
- `help` contains an aligned description.
- `command -h` and `command --help` show the expected usage.
- `man command` opens the correct manual.
- Valid options work and invalid options produce an error.
- Completion matches each operand type and position.
- Filesystem mutations call `persist()` only after successful changes.
- Sensitive mutations use `requirePassword()` where appropriate.
- Asynchronous output finishes before the next prompt appears.
- Remote or user-provided content is rendered as text, never HTML.

[Runtime API reference →](./runtime-api.md)
