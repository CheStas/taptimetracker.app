// The languages (locales/locales.json) and the visitor's choice, shared by the site pages and the app (§21 of
// docs/SPEC.md). The choice is localStorage `locale`, so a language picked on the site carries over to the app.
import list from '../locales/locales.json';

export interface Locale {
  code: string;
  /** In its own language, for the switcher and the setting. */
  name: string;
  ogLocale: string;
  /** The flag shown next to the name (public/flags/<flag>.svg, a country code). */
  flag: string;
  /** 'rtl' for right-to-left scripts (Persian). */
  dir?: 'rtl';
  /** The tag for Intl (dates, numbers) when it is not the code: Persian uses the Gregorian calendar and Latin digits, like the rest of the app. */
  intl?: string;
}
export const LOCALES = list as Locale[];
export const DEFAULT_LOCALE = LOCALES[0].code;
const KEY = 'locale';

/** The first preferred language that is one of `codes`, by language only ("uk-UA" -> "uk"). */
export function matchLocale(prefs: readonly string[], codes: readonly string[]): string | undefined {
  for (const p of prefs) {
    const base = p.toLowerCase().split(/[-_]/)[0];
    if (codes.includes(base)) return base;
  }
}

export function savedLocale(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && LOCALES.some((l) => l.code === v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLocale(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {}
}

const browserLanguages = () => (typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]);

/** The visitor's language: the saved choice, else the first browser language there is, else none. */
export const preferredLocale = (codes = LOCALES.map((l) => l.code)) => savedLocale() ?? matchLocale(browserLanguages(), codes);
