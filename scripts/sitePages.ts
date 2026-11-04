// Renders the site pages (src/site/pages/<page>.html) once per language they exist in (§21 of docs/SPEC.md): English
// at the root (/similar/), every other language under its code (/uk/similar/). Each page is a virtual Vite input, so
// no generated HTML lands in the repo; `npm run dev` serves the same pages. Also writes sitemap.xml with hreflang
// alternates.
//
// Templates: `{{key}}` is the page's locale file, then site.json (values may hold inline HTML); `{{key|attr}}` escapes
// for an attribute, `{{key|json}}` for a JSON string. `{{@name}}` and `{{@name:arg}}` are generated parts (see GEN).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const LOCALES_DIR = resolve(ROOT, 'locales');
const TEMPLATES = resolve(ROOT, 'src/site/pages');
export const ORIGIN = 'https://taptimetracker.app';

import type { Locale } from '../src/locale.ts';
export type { Locale };
export interface Page {
  id: string;
  /** The URL path below the language prefix: '' for the home page, 'similar/' … ('404.html' is a file, not a folder.) */
  path: string;
  /** The <body> class. */
  body: string;
  /** Only in English, with its copy in the template (privacy, terms): it has no locale file. */
  englishOnly?: boolean;
  /** The not-found page: served at any missing URL, so root-relative links; not in the footer, sitemap or app links. */
  notFound?: boolean;
}

/** Footer order. A new page is a template, an entry here and its locale files. */
export const PAGES: Page[] = [
  { id: 'home', path: '', body: 'landing' },
  { id: 'similar', path: 'similar/', body: 'similar' },
  { id: 'privacy', path: 'privacy/', body: 'legal', englishOnly: true },
  { id: 'terms', path: 'terms/', body: 'legal', englishOnly: true },
  { id: '404', path: '404.html', body: 'not-found', notFound: true },
];
const listed = PAGES.filter((p) => !p.notFound);

type Dict = Record<string, string>;
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

export function loadLocales(): Locale[] {
  return readJson(resolve(LOCALES_DIR, 'locales.json'));
}

/** Nested objects become dotted keys: { hero: { title } } -> "hero.title". */
function flatten(obj: Record<string, unknown>, prefix = '', out: Dict = {}): Dict {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') flatten(v as Record<string, unknown>, `${prefix}${k}.`, out);
    else out[prefix + k] = String(v);
  }
  return out;
}

const fileOf = (code: string, name: string) => resolve(LOCALES_DIR, code, `${name}.json`);
const loadDict = (code: string, name: string): Dict | null => (existsSync(fileOf(code, name)) ? flatten(readJson(fileOf(code, name))) : null);

/** Every language must have exactly the English keys in each file it has; English must have every page file. */
export function checkLocales(locales: Locale[], files = ['site', ...PAGES.filter((p) => !p.englishOnly).map((p) => p.id)]): string[] {
  const errors: string[] = [];
  const [en, ...rest] = locales;
  for (const name of files) {
    const base = loadDict(en.code, name);
    if (!base) {
      errors.push(`locales/${en.code}/${name}.json is missing`);
      continue;
    }
    for (const l of rest) {
      const d = loadDict(l.code, name);
      if (!d) {
        if (name === 'site') errors.push(`locales/${l.code}/site.json is missing`);
        continue;
      }
      const missing = Object.keys(base).filter((k) => !(k in d));
      const extra = Object.keys(d).filter((k) => !(k in base));
      if (missing.length) errors.push(`locales/${l.code}/${name}.json misses ${missing.join(', ')}`);
      if (extra.length) errors.push(`locales/${l.code}/${name}.json has keys English does not: ${extra.join(', ')}`);
    }
  }
  return errors;
}

/** The languages a page exists in, default first. */
export const pageLocales = (page: Page, locales: Locale[]) =>
  page.englishOnly ? [locales[0]] : locales.filter((l, i) => i === 0 || existsSync(fileOf(l.code, page.id)));

/** The URL path of a page in a language, from the site root: "", "similar/", "uk/", "uk/similar/". */
export const pagePath = (page: Page, code: string, locales: Locale[]) => (code === locales[0].code ? '' : `${code}/`) + page.path;

const esc = (s: string) => s.replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The page's HTML in one language. */
export function renderPage(page: Page, code: string, locales: Locale[]): string {
  const [en] = locales;
  const locale = locales.find((l) => l.code === code)!;
  const here = pagePath(page, code, locales);
  const root = page.notFound ? '/' : '../'.repeat(here.split('/').length - 1) || './';
  const site = loadDict(code, 'site')!;
  const dict: Dict = { ...site, ...(page.englishOnly ? {} : loadDict(code, page.id)) };
  const available = pageLocales(page, locales);
  const byId = (id: string) => PAGES.find((p) => p.id === id) ?? fail(`unknown page "${id}"`);
  const fail = (msg: string): never => {
    throw new Error(`${page.id} (${code}): ${msg}`);
  };
  /** A link to another page in this language, or in English when it does not exist in this one. */
  const href = (id: string) => {
    const target = byId(id);
    const inHere = pageLocales(target, locales).some((l) => l.code === code);
    return root + pagePath(target, inHere ? code : en.code, locales);
  };
  const t = (key: string) => dict[key] ?? fail(`no "${key}" in locales/${code}/${page.id}.json or site.json`);
  const url = (p: Page, c: string) => `${ORIGIN}/${pagePath(p, c, locales)}`;

  const GEN: Record<string, (arg: string) => string> = {
    lang: () => code,
    root: () => root,
    href,
    app: () => `${root}app/`,
    seo: () => [
      `<link rel="canonical" href="${url(page, code)}">`,
      ...(available.length > 1
        ? [...available.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${url(page, l.code)}">`),
          `<link rel="alternate" hreflang="x-default" href="${url(page, en.code)}">`]
        : []),
    ].join('\n  '),
    url: () => url(page, code),
    ogLocale: () => [`<meta property="og:locale" content="${locale.ogLocale}">`,
      ...available.filter((l) => l.code !== code).map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">`)].join('\n  '),
    header: () => `<header class="site-header">
    <a class="brand" href="${href('home')}"><img src="${root}favicon.svg" alt=""><span>${t('brand')}</span></a>
    <a class="button" href="${root}app/">${t('openApp')}</a>
  </header>`,
    footer: () => {
      const links = listed.filter((p) => p.id !== page.id).map((p) => {
        const english = !pageLocales(p, locales).some((l) => l.code === code);
        return `<a href="${href(p.id)}"${english ? ` hreflang="${en.code}"` : ''}>${t(`footer.${p.id}`)}${english ? ` <span class="muted">${t('footer.english')}</span>` : ''}</a>`;
      });
      // The language picker: a dropdown of real links (crawlable, works without JavaScript), each with its flag and
      // named in its own language; it opens upwards from the current one.
      const flag = (l: Locale, lazy = true) =>
        `<img class="flag" src="${root}flags/${l.flag}.svg" alt="" width="20" height="15"${lazy ? ' loading="lazy"' : ''}>`;
      const langs = locales.map((l) => {
        const target = !page.notFound && available.some((a) => a.code === l.code) ? page : byId('home');
        const current = l.code === code ? ' aria-current="true"' : '';
        return `<li><a href="${root}${pagePath(target, l.code, locales)}" hreflang="${l.code}" lang="${l.code}" data-locale="${l.code}"${current}>${flag(l)}<span>${l.name}</span></a></li>`;
      });
      return `<footer class="site-footer">
    <nav class="pages" aria-label="${esc(t('footer.pages'))}">${links.join('\n      ')}</nav>
    <details class="langs">
      <summary aria-label="${esc(t('footer.language'))}: ${esc(locale.name)}">${flag(locale, false)}<span>${locale.name}</span></summary>
      <ul aria-label="${esc(t('footer.language'))}">
        ${langs.join('\n        ')}
      </ul>
    </details>
  </footer>`;
    },
    // One hidden suggestion per other language this page exists in, written in that language; src/site/site.ts shows
    // the one that matches the visitor's preferred language.
    banner: () => available.filter((l) => l.code !== code).map((l) => {
      const s = loadDict(l.code, 'site')!;
      return `<div class="lang-banner" data-locale="${l.code}" lang="${l.code}" hidden>
    <span>${s['banner.text']}</span>
    <a class="button" href="${root}${pagePath(page, l.code, locales)}" hreflang="${l.code}" data-locale="${l.code}">${s['banner.go']}</a>
    <button class="close" type="button" aria-label="${esc(s['banner.close'])}">✕</button>
  </div>`;
    }).join('\n  '),
  };

  const template = readFileSync(resolve(TEMPLATES, `${page.id}.html`), 'utf8');
  // Copy first (it may contain {{@…}}, e.g. a link), then the generated parts.
  const withCopy = template.replace(/\{\{(?!@)([\w.-]+)(?:\|(attr|json))?\}\}/g, (_, key: string, filter?: string) =>
    filter === 'attr' ? esc(t(key)) : filter === 'json' ? JSON.stringify(t(key)).slice(1, -1) : t(key));
  const html = withCopy.replace(/\{\{@(\w+)(?::([\w-]+))?\}\}/g, (_, name: string, arg = '') =>
    (GEN[name] ?? fail(`unknown {{@${name}}}`))(arg));
  return html
    .replace('<html>', `<html lang="${code}"${locale.dir ? ` dir="${locale.dir}"` : ''} data-locales="${locales.map((l) => l.code).join(' ')}">`)
    .replace('<body>', `<body class="${page.body}">`);
}

/** Page path -> the languages it exists in, for the app's links to the site (__SITE_PAGES__). */
export const sitePageLocales = (locales = loadLocales()) =>
  Object.fromEntries(listed.map((p) => [p.path, pageLocales(p, locales).map((l) => l.code)]));

export function sitemap(locales: Locale[]): string {
  const urls = listed.flatMap((page) => {
    const available = pageLocales(page, locales);
    return available.map((l) => {
      const alts = available.length > 1
        ? available.map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.code}" href="${ORIGIN}/${pagePath(page, a.code, locales)}"/>`).join('')
          + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/${pagePath(page, locales[0].code, locales)}"/>`
        : '';
      return `  <url>\n    <loc>${ORIGIN}/${pagePath(page, l.code, locales)}</loc>${alts}\n  </url>`;
    });
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

/** Every page in every language: absolute index.html path (the Vite input id) -> what to render. */
function entries(): Map<string, { page: Page; code: string; path: string }> {
  const locales = loadLocales();
  const out = new Map<string, { page: Page; code: string; path: string }>();
  for (const page of PAGES) {
    for (const l of pageLocales(page, locales)) {
      const path = pagePath(page, l.code, locales);
      out.set(resolve(ROOT, path, path.endsWith('.html') ? '' : 'index.html'), { page, code: l.code, path });
    }
  }
  return out;
}

export function sitePages(): Plugin {
  let pages = entries();
  const check = () => {
    const errors = checkLocales(loadLocales());
    if (errors.length) throw new Error(`Locale files:\n  ${errors.join('\n  ')}`);
  };
  return {
    name: 'site-pages',
    config() {
      check();
      pages = entries();
      const input = Object.fromEntries([...pages].map(([file, { page, code }]) => [
        code === loadLocales()[0].code ? page.id : `${page.id}-${code}`, file]));
      return { build: { rollupOptions: { input } } };
    },
    resolveId(id) {
      if (pages.has(id)) return id;
    },
    load(id) {
      const e = pages.get(id);
      if (e) return renderPage(e.page, e.code, loadLocales());
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(loadLocales()) });
    },
    configureServer(server: ViteDevServer) {
      // Before Vite's own HTML handling: /, /similar/, /uk/ … come from the templates. Edits show on reload.
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '/').split('?')[0];
        if (path === '/sitemap.xml') {
          res.setHeader('content-type', 'application/xml');
          return res.end(sitemap(loadLocales()));
        }
        const file = resolve(ROOT, `.${path.endsWith('/') ? `${path}index.html` : path}`);
        pages = entries();
        const e = pages.get(file);
        if (!e) {
          // /uk/similar without the slash
          if (pages.has(resolve(ROOT, `.${path}/index.html`))) {
            res.statusCode = 301;
            res.setHeader('location', `${path}/`);
            return res.end();
          }
          return next();
        }
        try {
          const html = await server.transformIndexHtml(req.url ?? path, renderPage(e.page, e.code, loadLocales()));
          res.setHeader('content-type', 'text/html');
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
      // After Vite's own files and HTML: a page view nothing answered gets the not-found page, as on Cloudflare
      // (wrangler.jsonc not_found_handling): /uk/… the Ukrainian one, with status 404.
      return () => server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '/').split('?')[0];
        if (req.method !== 'GET' || !req.headers.accept?.includes('text/html')
          || existsSync(resolve(ROOT, `.${path.endsWith('/') ? `${path}index.html` : path}`))) return next();
        const locales = loadLocales();
        const notFound = PAGES.find((p) => p.notFound)!;
        const first = ((req as { originalUrl?: string }).originalUrl ?? path).split('/')[1];
        const code = pageLocales(notFound, locales).some((l) => l.code === first) ? first : locales[0].code;
        try {
          const html = await server.transformIndexHtml(`/${pagePath(notFound, code, locales)}`, renderPage(notFound, code, locales));
          res.statusCode = 404;
          res.setHeader('content-type', 'text/html');
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
