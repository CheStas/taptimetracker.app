/** package.json version, set by vite.config.ts. */
declare const __APP_VERSION__: string;
/** Site page path ("", "similar/") -> the languages it exists in, set by vite.config.ts (scripts/sitePages.ts). */
declare const __SITE_PAGES__: Record<string, string[]>;

interface ImportMetaEnv {
  /** Umami website id; without it no usage stats are sent (src/analytics.ts). */
  readonly VITE_UMAMI_ID?: string;
  /** The Umami script URL; Umami Cloud's by default. */
  readonly VITE_UMAMI_SRC?: string;
}
