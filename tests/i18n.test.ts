import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t, tn } from '../src/i18n.ts';

type Tree = { [k: string]: string | Tree };
const read = (code: string): Tree => JSON.parse(readFileSync(new URL(`../locales/${code}/app.json`, import.meta.url), 'utf8'));
const isPlural = (v: unknown) => typeof v === 'object' && v !== null && 'other' in v;

/** Dotted keys -> value; a plural object ({ one, other, … }) is one entry. */
function leaves(tree: Tree, prefix = '', out = new Map<string, string | Tree>()) {
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string' || isPlural(v)) out.set(prefix + k, v);
    else leaves(v, `${prefix}${k}.`, out);
  }
  return out;
}
const placeholders = (v: string | Tree) => new Set([...JSON.stringify(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

const en = leaves(read('en'));
const others = readdirSync(new URL('../locales/', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'en').map((d) => d.name);

describe.each(others)('locales/%s/app.json', (code) => {
  const tr = leaves(read(code));

  it('has exactly the English keys', () => {
    expect([...tr.keys()].filter((k) => !en.has(k))).toEqual([]);
    expect([...en.keys()].filter((k) => !tr.has(k))).toEqual([]);
  });

  it('has a plural object where English has one, with every form the language needs', () => {
    const forms = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const [k, v] of en) {
      if (!isPlural(v)) continue;
      expect(isPlural(tr.get(k)), k).toBe(true);
      for (const f of forms) expect(Object.keys(tr.get(k) as Tree), `${k}.${f}`).toContain(f);
    }
  });

  it('uses only placeholders the English text has', () => {
    for (const [k, v] of tr) {
      const known = placeholders(en.get(k)!);
      for (const p of placeholders(v)) expect(known.has(p), `${k}: {${p}}`).toBe(true);
    }
  });
});

describe('t and tn (English)', () => {
  it('fills placeholders', () => {
    expect(t('header.since', { time: '09:00' })).toBe('since 09:00');
  });

  it('picks the plural form', () => {
    expect(tn('summary.sessions', 1)).toBe('1 session');
    expect(tn('summary.sessions', 5)).toBe('5 sessions');
  });
});
