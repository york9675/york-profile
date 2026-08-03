# York Profile CLI development

This is the documentation hub for developing the fullscreen web terminal at `/cli`.

## Table of Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Module boundaries](#module-boundaries)
- [Command development](./commands.md)
  - Creating and registering a command
  - Arguments, options, and completion
  - Asynchronous commands
- [Runtime API reference](./runtime-api.md)
  - Terminal output and every available tone
  - `CommandContext`
  - Virtual filesystem
  - Shared configuration, services, and browser helpers
- [TUI application development](./tui-apps.md)
  - Fullscreen app lifecycle
  - Keyboard and text-input routing
  - Accessibility and cleanup
- [Themes and styling](./themes.md)
  - Terminal CSS variables
  - Adding and validating a theme
- [Release checklist](./release-checklist.md)
  - Manual behavior checks
  - Automated verification
  - Pull-request preparation

## Quick start

Use the repository's pnpm version for local development:

```sh
pnpm install
pnpm dev
```

Astro prints the active `Local` URL when the development server starts. Open that URL's `/cli` path. 

Choose the focused guide for the feature you are changing, then run the complete release gate before opening a pull request:

```sh
pnpm verify:cli
```

## Architecture

```text
src/scripts/cli.ts                    Stable browser entry point
src/scripts/cli/
├── app.ts                            Shell state, authentication, keyboard routing
├── config.ts                         Defaults, themes, storage keys, initial files
├── filesystem.ts                     Virtual filesystem and path handling
├── parser.ts                         Shell-like argument tokenizer
├── storage.ts                        Local-storage serialization boundary
├── system.ts                         Browser, heap, and uptime formatting
├── terminal.ts                       Output, syntax highlighting, completion, cursor
├── types.ts                          Shared application types
├── commands/
│   ├── index.ts                      Command registry
│   ├── types.ts                      CommandDefinition and CommandContext
│   ├── utils.ts                      Shared asynchronous loading status
│   └── <command>.ts                  One file per command
├── services/
│   └── ip.ts                         Cached public-IP lookup
├── docs/                             Contributor documentation
└── tui/
    ├── dom.ts                        Shared text-row DOM helper
    ├── nano.ts                       Fullscreen nano-style text editor
    ├── man.ts                        Fullscreen manual pager
    ├── settings.ts                   Settings application
    └── top.ts                        Task monitor application

src/styles/cli.css                    Terminal, theme, and TUI styles
src/pages/cli.astro                   `/cli` page markup and build metadata
scripts/verify-cli-themes.mjs         Theme completeness and contrast check
```

`commands/index.ts` is the only command registry. Help output, command highlighting, autocomplete, manuals, and execution are all derived from it.

## Module boundaries

- Keep `app.ts` focused on shell/session orchestration, authentication, keyboard routing, and dependency wiring.
- Keep command behavior in its command module; do not add command switches back to `app.ts`.
- Keep reusable network access and response validation in `services/`.
- Keep browser formatting and feature detection in `system.ts`.
- Keep shared identity, routes, defaults, and accepted values in `config.ts`. Astro also imports this module while rendering, so it must not access `window`, `document`, `navigator`, or `localStorage` at module scope.
- Keep storage reads and writes in `storage.ts`; commands should use `CommandContext`.
- Keep profile and repository URLs in `src/data/config.ts` and reuse them through CLI configuration instead of hard-coding copies.

## Documentation maintenance

Update the relevant focused guide whenever an exported contributor API, command definition field, TUI lifecycle rule, theme variable, or release check changes. Keep `cli-development.md` as the stable entry point so the in-terminal `sdk` command and existing links do not need to change.
