import { describe, expect, it } from 'vitest';
import { CONTACT, PAGES, checkLocales, loadLocales, pageLocales, pagePath, renderPage, sitemap } from '../scripts/sitePages.ts';
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

  it('mark right-to-left languages with dir', () => {
    expect(renderPage(page('home'), 'fa', locales)).toContain('<html lang="fa" dir="rtl"');
    expect(renderPage(page('home'), 'ja', locales)).not.toContain('dir="rtl"');
  });

  it('pick the language from a dropdown of links with flags, the current one shown and marked', () => {
    const html = renderPage(page('similar'), 'de', locales);
    expect(html).toContain('<summary aria-label="Sprache: Deutsch"><img class="flag" src="../../flags/de.svg"');
    for (const l of locales) expect(html).toContain(`hreflang="${l.code}" lang="${l.code}" data-locale="${l.code}"`);
    expect(html).toMatch(/data-locale="de" aria-current="true"><img class="flag" src="\.\.\/\.\.\/flags\/de\.svg"[^>]*loading="lazy">/);
  });

  it('serve the not-found page from any depth, unindexed and unlisted', () => {
    expect(pagePath(page('404'), 'uk', locales)).toBe('uk/404.html');
    const html = renderPage(page('404'), 'uk', locales);
    expect(html).toContain('<base href="/">');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('<a class="button primary" href="/uk/">');
    expect(html).toContain('<a href="/" hreflang="en" lang="en" data-locale="en">');
    expect(renderPage(page('home'), 'en', locales)).not.toContain('404');
    expect(sitemap(locales)).not.toContain('404');
  });

  it('give every listed page a link preview, and none to the not-found page', () => {
    for (const p of PAGES.filter((x) => !x.notFound)) {
      for (const l of pageLocales(p, locales)) {
        const html = renderPage(p, l.code, locales);
        for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:locale']) {
          expect(html, `${p.id} ${l.code} ${tag}`).toMatch(new RegExp(`<meta property="${tag}" content="[^"]+">`));
        }
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
      }
    }
    // The home page keeps its own preview text; other pages fall back to their title.
    expect(renderPage(page('home'), 'en', locales)).toContain('<meta property="og:title" content="Tap Time Tracker — know where your day went">');
    expect(renderPage(page('privacy'), 'en', locales)).toContain('<meta property="og:title" content="Privacy — Tap Time Tracker">');
    expect(renderPage(page('404'), 'en', locales)).not.toContain('og:');
  });

  it('show when a page last changed, in its language', () => {
    expect(renderPage(page('privacy'), 'en', locales)).toContain('<p class="updated">Last updated 4 November 2026</p>');
    expect(renderPage(page('home'), 'de', locales)).toContain('<p class="updated">Zuletzt aktualisiert am 10. November 2026</p>');
  });

  it('keep the titles and descriptions short enough to show in full in search results', () => {
    for (const p of PAGES.filter((x) => !x.notFound)) {
      for (const l of pageLocales(p, locales)) {
        const html = renderPage(p, l.code, locales);
        const title = html.match(/<title>([^<]*)<\/title>/)![1];
        const description = html.match(/<meta name="description" content="([^"]*)"/)![1].replace(/&[a-z]+;/g, '_');
        expect(title.length, `${p.id} ${l.code} title`).toBeLessThanOrEqual(60);
        expect(description.length, `${p.id} ${l.code} description`).toBeLessThanOrEqual(160);
      }
    }
  });

  it('list every page and language in the sitemap', () => {
    const xml = sitemap(locales);
    expect(xml).toContain('<loc>https://taptimetracker.app/uk/similar/</loc>\n    <lastmod>2026-11-10</lastmod>');
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

describe('structured data and answers', () => {
  /** Every JSON-LD block of a page, parsed. */
  const ld = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

  it('describe the app, its FAQ and its how-tos on the home page, in its language', () => {
    for (const l of locales) {
      const html = renderPage(page('home'), l.code, locales);
      const types = ld(html).map((d) => d['@type']);
      expect(types).toEqual(['WebApplication', 'FAQPage', 'HowTo', 'HowTo']);
      const [app, faq, ...howtos] = ld(html);
      expect(app.name).toBe('Tap Time Tracker');
      expect(app.publisher.email).toBe(CONTACT);
      expect(app.softwareVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(app.dateModified).toBe(page('home').updated);
      expect(app.featureList.length).toBe(12);
      expect(faq.inLanguage).toBe(l.code);
      // Every question in the markup is a visible heading, and every step a visible list item.
      expect(faq.mainEntity.length).toBe(13);
      for (const q of faq.mainEntity) expect(html).toContain(`<h3>${q.name}</h3>`);
      for (const h of howtos) expect(h.step.length).toBe(3);
      expect(html).toContain('<section class="faq" id="faq">');
      expect(html.match(/<ol class="steps"/g)?.length).toBe(2);
    }
  });

  it('give every other listed page a WebPage with breadcrumbs, and the similar page its ranked list', () => {
    const [webPage, list] = ld(renderPage(page('similar'), 'de', locales));
    expect(webPage['@type']).toBe('WebPage');
    expect(webPage.name).toBe('13 Ein-Tipp-Zeiterfassungen im Vergleich — Tap Time Tracker');
    expect(webPage.dateModified).toBe(page('similar').updated);
    expect(webPage.breadcrumb.itemListElement.map((i: { item: string }) => i.item))
      .toEqual(['https://taptimetracker.app/de/', 'https://taptimetracker.app/de/similar/']);
    expect(list['@type']).toBe('ItemList');
    expect(list.itemListElement[0]).toMatchObject({ position: 1, name: 'TickTappy' });
    const privacy = ld(renderPage(page('privacy'), 'en', locales));
    expect(privacy[0].breadcrumb.itemListElement[1].name).toBe('Privacy');
    expect(ld(renderPage(page('404'), 'en', locales))).toEqual([]);
  });

  it('compare the similar apps in a table, after question headings with short answers', () => {
    const html = renderPage(page('similar'), 'en', locales);
    expect(html.match(/<h2>[^<]*\?<\/h2>/g)?.length).toBe(3);
    expect(html).toContain('<table class="tools">');
    expect(html.match(/<th scope="row">/g)?.length).toBe(13);
  });

  it('link the FAQ and the contact address from every footer', () => {
    expect(renderPage(page('home'), 'en', locales)).toContain('<a href="#faq">FAQ</a>');
    expect(renderPage(page('home'), 'en', locales)).toContain('<p class="fine"><a href="./similar/">');
    const html = renderPage(page('similar'), 'uk', locales);
    expect(html).toContain('<a href="../../uk/#faq">Часті запитання</a>');
    expect(html).toContain(`<a href="mailto:${CONTACT}">${CONTACT}</a>`);
  });
});
