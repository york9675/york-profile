# Runtime API reference

[← Documentation table of contents](./cli-development.md)

## Table of Contents

- [Terminal output](#terminal-output)
- [Available tones](#available-tones)
- [CommandContext](#commandcontext)
- [Virtual filesystem](#virtual-filesystem)
- [Runtime state](#runtime-state)
- [Shared modules](#shared-modules)
- [Security and persistence boundaries](#security-and-persistence-boundaries)

## Terminal output

```ts
import { boldSegment, segment } from '../terminal';

terminal.appendLine('plain text');
terminal.appendLine('something failed', { tone: 'error' });
terminal.appendSegments([
  segment('label: ', 'accent'),
  boldSegment('value', 'bright'),
  segment(' · documentation', 'blue', 'https://example.com/docs')
]);
terminal.clearOutput();
terminal.scrollToBottom();
```

`appendLine()` and `appendSegments()` return the created `HTMLElement`. Keep it when asynchronous output must later be updated, replaced, or removed.

`appendLine()` accepts:

| Option | Effect |
| --- | --- |
| `tone` | Apply a tone to the entire line. |
| `spaced` | Add the terminal's extra vertical spacing. |
| `command` | Mark entered-command output. Normally only the shell uses this. |

`segment(text, tone?, href?)` creates one part of a mixed-style line. HTTP(S) links open safely in a new tab; internal paths remain same-tab links. `boldSegment()` accepts the same arguments and adds bold weight. A `Segment` can also set `bold: true` directly.

Use `renderSegments(container, segments)` only when a non-output container, such as a custom prompt, needs the same safe segment renderer. Shell lifecycle helpers such as `appendCommandLine()` and input presentation methods are owned by `app.ts` and should not normally be called by commands.

## Available tones

The named rows are every available `Tone` value. Omitting `tone` uses the default foreground shown first.

| Tone | Theme variable/effect | Intended use |
| --- | --- | --- |
| no tone | `--terminal-text` | Normal output and prose. |
| `muted` | `--terminal-muted` | Secondary text, hints, metadata, and loading status. |
| `accent` | `--terminal-accent` | Labels, active values, and primary accents. |
| `blue` | `--terminal-blue` | Paths, directories, and links. |
| `yellow` | `--terminal-yellow` | Warnings, highlights, and noteworthy values. |
| `error` | `--terminal-red` | Errors, failures, and unavailable values. |
| `magenta` | `--terminal-magenta` | Search-result filenames or a distinct data category. |
| `cyan` | `--terminal-cyan` | A secondary accent or distinct data category. |
| `bright` | `--terminal-bright` | High emphasis, separators, and prompt punctuation. |
| `bold` | `font-weight: 700` | Weight only; prefer `boldSegment(text, colorTone)` when color is also needed. |

There are no `red`, `green`, or `white` tones. Use `error`, `accent`, and `bright` so output follows every theme.

## CommandContext

Every command receives this supported API through `execute(context, args)`:

| Member | Purpose |
| --- | --- |
| `terminal` | Append, update, clear, and scroll terminal output. |
| `fileSystem` | Access the browser-only virtual filesystem. |
| `metadata` | Build-provided version, environment, Astro, Preact, TypeScript, and package count. |
| `history` | Read-only command history. |
| `commands` | Read-only registered command definitions. |
| `getSession()` | Read a fresh user, host, theme, cursor, and password snapshot. |
| `updateSession(patch)` | Update user, host, cursor style/blink, or password-on-refresh. |
| `persist()` | Save settings, history, and filesystem to local storage. |
| `updatePrompt()` | Re-render the prompt after user, host, or path changes. |
| `applyTheme(theme)` | Apply a validated theme and synchronize browser theme color. |
| `requirePassword(action)` | Run a sensitive action now or after successful verification. |
| `exitTerminal()` | Print logout and return to the profile without an extra prompt. |
| `logoutSession()` | Lock or end the current session according to authentication settings. |
| `configurePassword(args)` | Enter the shared password setup or disable flow. |
| `requestDataReset()` | Start typed confirmation for clearing all locally stored CLI data. |
| `openSettings()` | Open the settings TUI. |
| `openTop()` | Open the task-monitor TUI. |
| `openEditor(file?)` | Open nano with an optional virtual filename. |
| `openManual(command?)` | Open a registered command in the manual pager. |

Do not mutate a copied session snapshot. Use an action or `updateSession()`, perform related work, refresh the prompt when necessary, and persist after success.

## Virtual filesystem

Normalize user-provided paths before lookup.

| Member | Purpose |
| --- | --- |
| `currentPath` | Current absolute directory; change only after validating the destination. |
| `homePath` | Current user's absolute home directory. |
| `directories` | Map of directory paths to child basenames. Prefer methods for mutation. |
| `files` | Map of file paths to arrays of text lines. Prefer `writeFile()`. |
| `normalize(value)` | Resolve `.`, `..`, `~`, relative paths, and absolute paths. |
| `kind(path)` | Return `file`, `directory`, or `null`. |
| `isReadOnly(path)` | Report whether a bundled entry is immutable. |
| `getModifiedAt(path)` | Return an entry's persisted ISO modification timestamp. |
| `basename(path)` / `dirname(path)` | Return a final component or parent path. |
| `childPath(parent, name)` | Join parent and child without a double slash at root. |
| `addDirectory(path)` | Create one directory when its parent exists and return success. |
| `writeFile(path, lines)` | Create or replace a text file and return success. |
| `touch(path)` | Update a writable file's modification time and return success. |
| `remove(path)` | Recursively remove an entry and return success. It has no protected-path policy. |
| `walk(path)` | Return an entry and all descendants depth-first. |
| `migrateHome(username)` | Rename the home tree and update the path and `.profile`. |
| `snapshot()` / `restore(snapshot)` | Serialize or restore state at the storage boundary. |
| `reset(username?)` | Restore bundled entries and remove user-created filesystem data. |

Bundled content and system directories are immutable: they may be read and copied, but not edited, touched, renamed, or removed. The user's home directory is the writable workspace; new entries created there are writable and receive modification timestamps. Commands still enforce Unix-like policy before mutation; protect `/`, home, and the active working tree before calling `remove()`. Reuse `commands/fs-helpers.ts` for existing copy, move, and destination semantics. Call `context.persist()` after successful filesystem changes.

## Runtime state

`getSession()` always returns a fresh snapshot. For a username change, the complete pattern is:

```ts
context.updateSession({ username: nextName });
context.fileSystem.migrateHome(nextName);
context.updatePrompt();
context.persist();
```

Theme changes use `applyTheme()` followed by `persist()`. Data clearing and password state are deliberately owned by their existing shared flows rather than arbitrary session patches.

## Shared modules

| Module/export | Use |
| --- | --- |
| `config.ts` — `cliConfig` | CLI identity, routes, repository/documentation links, user ID, and history limit. |
| `config.ts` — `serviceUrls` | Remote service endpoints. |
| `config.ts` — `openAliases` | Valid aliases for `open`. |
| `config.ts` — `themes`, `themeMetadata`, `cursorStyles` | Settings values, metadata, validation, and completion sources. |
| `config.ts` — `defaultSettings`, `validation` | Defaults and shared input validation. |
| `system.ts` — `formatUptime()` | Format seconds as hours, minutes, and seconds. |
| `system.ts` — `getHeapInfo()` / `getHeapSummary()` | Return heap usage, percentage, and a supported fallback. |
| `system.ts` — `getBrowserName()` | Detect a useful browser/terminal name. |
| `system.ts` — `isMobileDevice()` | Detect mobile browsers for device-specific terminal guidance. |
| `services/ip.ts` — `getPublicIpInfo()` | Fetch, validate, cache, and deduplicate public-IP lookup. |
| `commands/utils.ts` — `withLoadingStatus()` | Show and remove loading output around a promise. |
| `tui/dom.ts` — `appendTuiLine()` | Append a safe text-only TUI row. |

## Security and persistence boundaries

- Render untrusted, remote, and user-provided values with `textContent`, `createTextNode`, or terminal helpers. Never use `innerHTML`.
- Commands use `context.persist()` instead of importing `storage.ts`.
- Keep remote calls in `services/`, require CORS-compatible HTTPS endpoints, and validate status and data.
- Never display secrets or stored password hashes.
- Password entry rendering and verification are owned by `app.ts`; reuse its actions.
- The virtual filesystem never accesses the visitor's real filesystem.
- `config.ts` must remain safe during server rendering and cannot access browser globals at module scope.

[Command development ←](./commands.md) · [TUI development →](./tui-apps.md)
