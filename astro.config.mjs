// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://york.qzz.io',
  output: 'static',
  i18n: {
    locales: ['en', 'tw'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false
    }
  },
  prefetch: {
    defaultStrategy: 'viewport'
  },
  image: {
    domains: ['avatars.githubusercontent.com']
  },
  server: {
    host: true,
    port: 3000
  },
  integrations: [sitemap(), preact()]
});
