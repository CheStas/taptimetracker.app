// The app's strings (§21.4 of docs/SPEC.md): locales/<code>/app.json, English bundled, other languages loaded on
// start. `t('summary.title')`, `t('popup.since', { name })` with {name} placeholders; `tn('popup.sessions', n)` picks
// the plural form with Intl.PluralRules; `tx` puts elements (links, <strong>) into a sentence. Keys are type-checked
// against the English file.
import type { ComponentChildren } from 'preact';
import en from '../locales/en/app.json';
import { DEFAULT_LOCALE, preferredLocale, saveLocale } from './locale.ts';

type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Tree = typeof en;
type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;
/** Dotted paths to plain strings. */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? Join<P, K> : T[K] extends { other: string } ? never : Paths<T[K], Join<P, K>>;
}[keyof T & string];
/** Dotted paths to plural objects ({ one, other } in English). */
type PluralPaths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? never : T[K] extends { other: string } ? Join<P, K> : PluralPaths<T[K], Join<P, K>>;
}[keyof T & string];
export type Key = Paths<Tree>;
export type PluralKey = PluralPaths<Tree>;
type Vars = Record<string, string | number>;

// English is bundled above; every other language is its own chunk, loaded only when it is the app's language.
const loaders = import.meta.glob<{ default: unknown }>(['../locales/*/app.json', '!../locales/en/app.json']);
/** The languages the app has (every locales/<code>/app.json). */
export const APP_LOCALES = [DEFAULT_LOCALE, ...Object.keys(loaders).map((p) => p.split('/')[2])];

let current = DEFAULT_LOCALE;
let tree: unknown = en;
let rules = new Intl.PluralRules(current);
const listeners = new Set<() => void>();

const lookup = (from: unknown, key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], from);
/** This language's value, else English (a key missing in a language never shows as the key). */
const value = (key: string) => lookup(tree, key) ?? lookup(en, key) ?? key;
const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

export function t(key: Key, vars?: Vars): string {
  return fill(value(key) as string, vars);
}

/** A count: the plural form for `n` (as {n}), e.g. "1 session" / "5 sessions", "5 сеансів". */
export function tn(key: PluralKey, n: number, vars?: Vars): string {
  const p = value(key) as Plural;
  return fill(p[rules.select(n)] ?? p.other, { n, ...vars });
}

/** A sentence with elements in it: tx('about.stats', { link: <a …>…</a> }) for "… {link}". */
export function tx(key: Key, parts: Record<string, ComponentChildren>): ComponentChildren[] {
  return (value(key) as string).split(/(\{\w+\})/).map((piece) => {
    const m = /^\{(\w+)\}$/.exec(piece);
    return m && m[1] in parts ? parts[m[1]] : piece;
  });
}

/**
 * A first-run or demo name in the app's language (seed.names, keyed by the English name in lower case): "meeting" ->
 * "Зустріч". English and names that are not there stay as they are; names a user typed never go through this.
 */
export function seedName(name: string): string {
  if (current === DEFAULT_LOCALE) return name;
  return (lookup(tree, 'seed.names') as Record<string, string> | undefined)?.[name.trim().toLowerCase()] ?? name;
}

/** The app's language code, for Intl (dates, numbers). */
export const locale = () => current;

async function load(code: string) {
  const file = loaders[`../locales/${code}/app.json`] as (() => Promise<{ default: unknown }>) | undefined;
  tree = file ? (await file()).default : en;
  current = file ? code : DEFAULT_LOCALE;
  rules = new Intl.PluralRules(current);
  document.documentElement.lang = current;
}

/** On start: the saved choice, else the browser's languages, else English. */
export const initLocale = () => load(preferredLocale(APP_LOCALES) ?? DEFAULT_LOCALE);

/** Settings → Device → Language: saved for the app and the site, and the app re-renders. */
export async function setLocale(code: string) {
  saveLocale(code);
  await load(code);
  listeners.forEach((fn) => fn());
}

export function onLocaleChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
