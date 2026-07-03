// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://york.qzz.io',
  output: 'static',
  server: {
    host: true,
    port: 3000
  },
  integrations: [sitemap()]
});
