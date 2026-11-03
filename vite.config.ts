import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { sitePages } from './scripts/sitePages.ts';
import pkg from './package.json' with { type: 'json' };

// A static site: the landing page at the root, the app (the PWA) under app/, and plain pages next to it. public/ holds
// the files copied as they are (favicon, the app's manifest and icons). The site pages are rendered per language from
// src/site/pages/ and locales/ by scripts/sitePages.ts, which adds them as inputs (and writes sitemap.xml).
// `--mode single` builds only the app, inlined into one HTML file that works from file:// (see npm run build:single).
const app = 'app/index.html';
// The single file has no favicon, manifest or icons next to it.
const dropSiteLinks = { name: 'drop-site-links', transformIndexHtml: (html: string) => html.replace(/\s*<link rel="(icon|manifest|apple-touch-icon)"[^>]*>/g, '') };

export default defineConfig(({ mode }) => ({
  base: './', // relative paths, so dist/ works from any static host or subpath
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [preact(), ...(mode === 'single' ? [viteSingleFile(), dropSiteLinks] : [sitePages()])],
  publicDir: mode === 'single' ? false : 'public',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    rollupOptions: { input: { app } },
  },
  test: { include: ['tests/**/*.test.ts'] },
}));
