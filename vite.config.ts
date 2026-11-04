import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { sitePageLocales, sitePages } from './scripts/sitePages.ts';
import pkg from './package.json' with { type: 'json' };

// A static site: the landing page at the root, the app (the PWA) under app/, and plain pages next to it. public/ holds
// the files copied as they are (favicon, the app's manifest and icons). The site pages are rendered per language from
// src/site/pages/ and locales/ by scripts/sitePages.ts, which adds them as inputs (and writes sitemap.xml).
const app = 'app/index.html';

export default defineConfig({
  base: './', // relative paths, so dist/ works from any static host or subpath
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __SITE_PAGES__: JSON.stringify(sitePageLocales()) },
  plugins: [preact(), sitePages()],
  build: {
    rollupOptions: { input: { app } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
