/**
 * Shared site configuration.
 */

export const profileLinks = {
  /**
   * Main code/profile links.
   */
  github: 'https://github.com/york9675',
  projectRepository: 'https://github.com/york9675/york-profile',
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
  buyMeACoffee: 'https://www.buymeacoffee.com/york0524',
  volanta: 'https://fly.volanta.app/profile/York'
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
   * Last.fm proxy endpoint for the now playing widget.
   *
   * Test routes:
   * - /test/slow (default 6000ms), optional override with ?ms=3000
   * - /test/missing-artist
   * - /test/missing-album
   * - /test/missing-both
   */
  apiUrl: 'https://lastfm-proxy.york.qzz.io/',

  /**
   * Last.fm username for fallback profile/library links when the API does not
   * include the current account name.
   */
  username: 'york0524',

  /**
   * Primary Last.fm profile URL used across the site.
   */
  profileUrl: 'https://www.last.fm/user/york0524',

  /**
   * Account/library start date shown in the now playing footer.
   */
  sinceDateIso: '2025-07-11T00:00:00Z'
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
