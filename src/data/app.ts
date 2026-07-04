import packageJson from '../../package.json';

export const profile = {
  name: 'York',
  handle: 'york0524',
  avatar: 'https://avatars.githubusercontent.com/u/84720688?v=4',
  avatarOptimizedSource: 'https://avatars.githubusercontent.com/u/84720688?s=320&v=4',
  orgAvatar: 'https://avatars.githubusercontent.com/u/178259609?v=4',
  orgAvatarOptimizedSource: 'https://avatars.githubusercontent.com/u/178259609?s=256&v=4',
  email: 'york@york.qzz.io',
  siteUrl: 'https://york.qzz.io',
  description: 'Personal profile of York (york0524).'
} as const;

export const appInfo = {
  version: packageJson.version,
  astroVersion: packageJson.dependencies.astro.replace(/^[^\d]*/, ''),
  appEnv: import.meta.env.MODE
} as const;
