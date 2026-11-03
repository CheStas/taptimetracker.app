import { describe, expect, it } from 'vitest';
import { PAGES, checkLocales, loadLocales, pageLocales, pagePath, renderPage, sitemap } from '../scripts/sitePages.ts';
import { matchLocale } from '../src/locale.ts';

const locales = loadLocales();
const page = (id: string) => PAGES.find((p) => p.id === id)!;

describe('locale files', () => {
  it('have the same keys in every language', () => {
    expect(checkLocales(locales)).toEqual([]);
  });

  it('render every page in every language it exists in, with no placeholder left', () => {
    for (const p of PAGES) {
      for (const l of pageLocales(p, locales)) expect(renderPage(p, l.code, locales)).not.toMatch(/\{\{/);
    }
  });
});

describe('site pages', () => {
  it('put English at the root and other languages under their code', () => {
    expect(pagePath(page('home'), 'en', locales)).toBe('');
    expect(pagePath(page('similar'), 'uk', locales)).toBe('uk/similar/');
  });

  it('keep privacy and terms English only', () => {
    expect(pageLocales(page('privacy'), locales).map((l) => l.code)).toEqual(['en']);
  });

  it('have lang, a self canonical and hreflang alternates', () => {
    const html = renderPage(page('similar'), 'uk', locales);
    expect(html).toContain('<html lang="uk"');
    expect(html).toContain('<link rel="canonical" href="https://taptimetracker.app/uk/similar/">');
    expect(html).toContain('hreflang="en" href="https://taptimetracker.app/similar/"');
    expect(html).toContain('hreflang="x-default" href="https://taptimetracker.app/similar/"');
  });

  it('link English-only pages from other languages as English', () => {
    const html = renderPage(page('home'), 'uk', locales);
    expect(html).toMatch(/<a href="\.\.\/privacy\/" hreflang="en">/);
    expect(html).not.toContain('uk/privacy');
  });

  it('switch to the home page of a language a page does not exist in', () => {
    const html = renderPage(page('terms'), 'en', locales);
    expect(html).toContain('<a href="../uk/" hreflang="uk" lang="uk" data-locale="uk">');
  });

  it('list every page and language in the sitemap', () => {
    const xml = sitemap(locales);
    expect(xml).toContain('<loc>https://taptimetracker.app/uk/similar/</loc>');
    expect(xml).toContain('<loc>https://taptimetracker.app/privacy/</loc>');
    expect(xml).not.toContain('uk/privacy');
  });
});

describe('matchLocale', () => {
  it('matches by language, in preference order', () => {
    expect(matchLocale(['de-DE', 'uk-UA', 'en'], ['en', 'uk'])).toBe('uk');
    expect(matchLocale(['EN-gb'], ['en', 'uk'])).toBe('en');
    expect(matchLocale(['ru', 'pl'], ['en', 'uk'])).toBeUndefined();
  });
});
