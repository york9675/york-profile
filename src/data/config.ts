import packageJson from '../../package.json';

/**
 * Shared site configuration.
 */

const githubProfile = packageJson.author.url.replace(/\/$/, '');
const projectRepository = packageJson.homepage;
const projectDefaultBranch = 'main';

export const profileLinks = {
  /**
   * Main code/profile links.
   */
  github: githubProfile,
  projectRepository,
  organizationSite: 'https://york9675.github.io/website',

  /**
   * Community links.
   */
  discordProfile: 'https://discordapp.com/users/571310191807692821',
  steamProfile: 'https://steamcommunity.com/profiles/76561199220072885',

  /**
   * Music/support links.
   */
  soundcloud: 'https://soundcloud.com/york0524',
  bandcamp: 'https://524-hz.bandcamp.com/',
  koFi: 'https://ko-fi.com/york0524',
  volanta: 'https://fly.volanta.app/profile/York'
} as const;

export const projectLinks = {
  documentation: `${projectRepository}/blob/${projectDefaultBranch}/src/scripts/cli/docs/cli-development.md`,
  issues: packageJson.bugs.url,
  newPullRequest: `${projectRepository}/compare`
} as const;

export const profileHandles = {
  /**
   * Service-specific handles/usernames that may differ from the main site
   * handle in `src/data/app.ts`.
   */
  discord: 'york0524',
  twitter: 'york0524'
} as const;

export const nowPlayingConfig = {
  /**
   * ListenBrainz account and API configuration for the now playing widget.
   */
  username: 'York',
  profileUrl: 'https://listenbrainz.org/user/York/'
} as const;

export const vercelToolbarConfig = {
  /**
   * Vercel project id used by the development-only feedback toolbar script.
   */
  projectId: 'prj_bRdDHFkFdH7YZmPcbWgSgB7bA38U',

  /**
   * Vercel owner/team id used by the development-only feedback toolbar script.
   */
  ownerId: 'team_lO4dEQU7946C21LoJmzJTUP7'
} as const;
