// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://york.qzz.io',
  output: 'static',
  integrations: [sitemap()],
  image: {
    domains: ['avatars.githubusercontent.com']
  }
});
