import { cliConfig } from '../config';
import { segment } from '../terminal';
import type { CommandDefinition } from './types';

export const sdkCommand: CommandDefinition = {
  name: 'sdk',
  usage: 'sdk [-h]',
  description: 'learn how to develop and contribute CLI features',
  manual: 'Show where the CLI development guide lives, how to add commands and TUI applications, and how to contribute changes through a GitHub pull request.',
  execute: ({ terminal }) => {
    terminal.appendLine(`${cliConfig.name} Software Development Kit`, { tone: 'accent' });
    terminal.appendLine('Interested in building new commands or TUI applications for the York Profile CLI?');
    terminal.appendLine('You can learn how to develop and contribute CLI features here!');
    terminal.appendLine('');
    terminal.appendLine('Developer documentation', { tone: 'accent' });
    terminal.appendLine(`  Local:  ${cliConfig.documentationPath}`);
    terminal.appendSegments([
      segment('  GitHub: ', 'muted'),
      segment(cliConfig.documentationUrl, 'blue', cliConfig.documentationUrl)
    ]);
    terminal.appendLine('');
    terminal.appendLine('Contribute', { tone: 'accent' });
    terminal.appendLine('  1. Fork the repository and create a focused branch.');
    terminal.appendLine('  2. Implement and test the change without unrelated edits.');
    terminal.appendLine('  3. Push your branch and open a pull request on GitHub.');
    terminal.appendSegments([
      segment('  Repository:   ', 'muted'),
      segment(cliConfig.repositoryUrl, 'blue', cliConfig.repositoryUrl)
    ]);
    terminal.appendSegments([
      segment('  Open a PR:    ', 'muted'),
      segment(cliConfig.pullRequestUrl, 'blue', cliConfig.pullRequestUrl)
    ]);
  }
};
