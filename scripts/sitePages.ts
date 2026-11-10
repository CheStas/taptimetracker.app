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
/** The site's contact address: in every footer, the privacy page and the publisher's JSON-LD. */
export const CONTACT = 'contact@taptimetracker.app';

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
  /** When the page's content last changed (YYYY-MM-DD), set by hand with the change: shown as {{@updated}}, and the
   *  page's JSON-LD dateModified and sitemap lastmod. Every listed page has one. */
  updated?: string;
}

/** Footer order. A new page is a template, an entry here and its locale files. */
export const PAGES: Page[] = [
  { id: 'home', path: '', body: 'landing', updated: '2026-11-10' },
  { id: 'similar', path: 'similar/', body: 'similar', updated: '2026-11-10' },
  { id: 'privacy', path: 'privacy/', body: 'legal', englishOnly: true, updated: '2026-11-04' },
  { id: 'terms', path: 'terms/', body: 'legal', englishOnly: true, updated: '2026-11-04' },
  { id: '404', path: '404.html', body: 'not-found', notFound: true },
];
const listed = PAGES.filter((p) => !p.notFound);
/** The app's version (package.json), for the WebApplication's softwareVersion. */
const VERSION: string = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;

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

/** Inline HTML from a locale value as plain text, for JSON-LD. */
const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** A JSON-LD script; `<` is escaped so no value can close the tag. */
const jsonLd = (data: object) => `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', ...data }, null, 2)
  .replace(/</g, '\\u003c').replace(/^/gm, '    ')}\n  </script>`;

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
  /** The ids under a locale key, in file order: ids('faq.items') -> ['free', 'account', …]. */
  const ids = (prefix: string) => [...new Set(Object.keys(dict).filter((k) => k.startsWith(`${prefix}.`))
    .map((k) => k.slice(prefix.length + 1).split('.')[0]))];
  /** Step lists on this page (`<x>.howto` + `<x>.steps.*`), each shown with {{@steps:x}} and marked up as a HowTo. */
  const howtos = () => [...new Set(Object.keys(dict).filter((k) => k.endsWith('.howto')).map((k) => k.slice(0, -'.howto'.length)))];
  let copy = ''; // the template with its copy filled in, for the page's own title and description
  const meta = (re: RegExp) => plain(copy.match(re)?.[1] ?? fail(`no ${re}`)).replace(/&amp;/g, '&');
  const publisher = {
    '@type': 'Organization', name: t('brand'), url: `${ORIGIN}/`, email: CONTACT, logo: `${ORIGIN}/app/icon-512.png`,
  };

  const updated = () => page.updated ?? fail('no "updated" date in PAGES');
  const ogLocale = () => [`<meta property="og:locale" content="${locale.ogLocale}">`,
    ...available.filter((l) => l.code !== code).map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">`)];

  const GEN: Record<string, (arg: string) => string> = {
    lang: () => code,
    root: () => root,
    href,
    app: () => `${root}app/`,
    // Canonical, hreflang and the link preview (Open Graph + Twitter card) of every listed page. The preview uses the
    // page's `og.title` / `og.description` when its locale file has them, else its <title> and description.
    seo: () => [
      `<link rel="canonical" href="${url(page, code)}">`,
      ...(available.length > 1
        ? [...available.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${url(page, l.code)}">`),
          `<link rel="alternate" hreflang="x-default" href="${url(page, en.code)}">`]
        : []),
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${esc(t('brand'))}">`,
      `<meta property="og:url" content="${url(page, code)}">`,
      `<meta property="og:title" content="${esc(dict['og.title'] ?? meta(/<title>([^<]*)<\/title>/))}">`,
      `<meta property="og:description" content="${esc(dict['og.description'] ?? meta(/<meta name="description" content="([^"]*)"/))}">`,
      ...ogLocale(),
      `<meta property="og:image" content="${ORIGIN}/og.png">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="${esc(t('ogImageAlt'))}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
    ].join('\n  '),
    // "Last updated 10 November 2026", in the page's language (English day first, as the site's copy writes dates).
    updated: () => `<p class="updated">${t('updated').replace('{date}', new Intl.DateTimeFormat(code === en.code ? 'en-GB' : locale.intl ?? code,
      { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${updated()}T00:00:00Z`)))}</p>`,
    url: () => url(page, code),
    // The page's structured data (SPEC §19): the app, its FAQ and how-tos on the home page; a breadcrumbed WebPage
    // everywhere else. Built from the same keys as the visible text.
    ld: () => {
      if (page.notFound) return '';
      if (page.id === 'home') {
        const faq = ids('faq.items');
        return [
          jsonLd({
            '@type': 'WebApplication', name: t('brand'), url: url(page, code), inLanguage: code,
            description: t('ld.description'), applicationCategory: 'ProductivityApplication',
            operatingSystem: t('ld.os'), browserRequirements: t('ld.requirements'), image: `${ORIGIN}/og.png`,
            screenshot: { '@type': 'ImageObject', url: `${ORIGIN}/og.png`, caption: t('ogImageAlt'), width: 1200, height: 630 },
            // The feature names the page already shows: no account, on-device storage, ways to organize, the extras.
            featureList: ['vault.account', 'vault.device', ...['track', 'extras'].flatMap((s) => ids(s)
              .filter((id) => dict[`${s}.${id}.title`]).map((id) => `${s}.${id}`))].map((k) => plain(t(`${k}.title`))),
            softwareVersion: VERSION, dateModified: updated(),
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher,
          }),
          ...(faq.length ? [jsonLd({
            '@type': 'FAQPage', inLanguage: code,
            mainEntity: faq.map((id) => ({
              '@type': 'Question', name: plain(t(`faq.items.${id}.q`)),
              acceptedAnswer: { '@type': 'Answer', text: plain(t(`faq.items.${id}.a`)) },
            })),
          })] : []),
          ...howtos().map((h) => jsonLd({
            '@type': 'HowTo', name: plain(t(`${h}.howto`)), inLanguage: code,
            step: ids(`${h}.steps`).map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: plain(t(`${h}.steps.${s}`)) })),
          })),
        ].join('\n  ');
      }
      const home = byId('home');
      return jsonLd({
        '@type': 'WebPage', name: meta(/<title>([^<]*)<\/title>/), description: meta(/<meta name="description" content="([^"]*)"/),
        url: url(page, code), inLanguage: code, dateModified: updated(),
        isPartOf: { '@type': 'WebSite', name: t('brand'), url: `${ORIGIN}/`, publisher },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: t('footer.home'), item: url(home, pageLocales(home, locales).some((l) => l.code === code) ? code : en.code) },
            { '@type': 'ListItem', position: 2, name: t(`footer.${page.id}`), item: url(page, code) },
          ],
        },
      });
    },
    faq: () => ids('faq.items').map((id) => `<div class="qa">
          <h3>${t(`faq.items.${id}.q`)}</h3>
          <p>${t(`faq.items.${id}.a`)}</p>
        </div>`).join('\n        '),
    steps: (h) => `<ol class="steps" aria-label="${esc(plain(t(`${h}.howto`)))}">
          ${ids(`${h}.steps`).map((s) => `<li>${t(`${h}.steps.${s}`)}</li>`).join('\n          ')}
        </ol>`,
    header: () => `<header class="site-header">
    <a class="brand" href="${href('home')}"><img src="${root}favicon.svg" alt=""><span>${t('brand')}</span></a>
    <a class="button" href="${root}app/">${t('openApp')}</a>
  </header>`,
    footer: () => {
      const links = listed.filter((p) => p.id !== page.id).map((p) => {
        const english = !pageLocales(p, locales).some((l) => l.code === code);
        return `<a href="${href(p.id)}"${english ? ` hreflang="${en.code}"` : ''}>${t(`footer.${p.id}`)}${english ? ` <span class="muted">${t('footer.english')}</span>` : ''}</a>`;
      });
      // The FAQ (a section of the home page) right after Home, and the contact address last.
      links.splice(page.id === 'home' ? 0 : 1, 0, `<a href="${page.id === 'home' ? '' : href('home')}#faq">${t('footer.faq')}</a>`);
      links.push(`<a href="mailto:${CONTACT}">${CONTACT}</a>`);
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
  const withCopy = copy = template.replace(/\{\{(?!@)([\w.-]+)(?:\|(attr|json))?\}\}/g, (_, key: string, filter?: string) =>
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
      const lastmod = page.updated ? `\n    <lastmod>${page.updated}</lastmod>` : '';
      return `  <url>\n    <loc>${ORIGIN}/${pagePath(page, l.code, locales)}</loc>${lastmod}${alts}\n  </url>`;
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
