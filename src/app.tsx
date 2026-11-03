// Entry point: view switching (hash routes), Esc/back, theme, full screen, quit, day rollover, wake lock, auto-export,
// the service worker.
import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { parseHash, routeHash, type Route, type View } from './route.ts';
import { init, subscribe, checkRollover, resetDay, state, notify, activeSegment, activityById, todayTotal } from './state.ts';
import { cssVars, findTheme, resolveTheme } from './theme.ts';
import { DEMO } from './db.ts';
import { bucket, pageview, startStats, trackDaily } from './analytics.ts';
import { Main } from './ui/main.tsx';
import { Settings } from './ui/settings.tsx';
import { Summary } from './ui/summary.tsx';
import { DayEditor } from './ui/dayEditor.tsx';
import { ModalHost, closeTopModal, confirmDialog, messageDialog } from './ui/hooks.tsx';
import { HoverTip, ScrollTop, type Nav } from './ui/header.tsx';
import { openProfilePicker } from './ui/profiles.tsx';
import { download, fmtDayShort, fmtHours, isoDay, slug } from './ui/util.ts';
import { initLocale, onLocaleChange, t } from './i18n.ts';
import './fonts.css';
import './styles.css';

/** The history entry's state: the view it was opened from (set by `go`). */
type Entry = { from?: View } | null;
const entry = (): Entry => history.state;

// Esc / back goes up this hierarchy; main has no parent, so there are no loops. The day editor goes back to where it
// was opened from: Settings, Summary, or Main (the activity popup's "Edit sessions"); Settings after a reload.
const parentOf = (view: View): View | undefined =>
  view === 'main' ? undefined : view === 'day-editor' ? entry()?.from ?? 'settings' : 'main';

function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const { view } = route;
  // Main and Settings scroll the page; each view starts at its top.
  useLayoutEffect(() => window.scrollTo(0, 0), [view]);
  // A page view per view (the first one is sent by startStats).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else pageview();
  }, [view]);

  // The browser's back/forward buttons and edits of the address.
  useEffect(() => {
    const onPop = () => setRoute(parseHash(location.hash));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  /** Open a route: a new history entry, or the same one when the view stays (Settings → another section). */
  const go = (to: Route) => {
    if (to.view === view) history.replaceState(entry(), '', routeHash(to));
    else history.pushState({ from: view } satisfies Entry, '', routeHash(to));
    setRoute(to);
  };
  /** Back = up the hierarchy. When this entry was opened from the parent, that is a browser back (no extra entry). */
  const up = () => {
    const to = parentOf(view);
    if (!to) return;
    if (entry()?.from === to) return history.back();
    history.replaceState(null, '', routeHash({ view: to }));
    setRoute({ view: to });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (!closeTopModal()) up();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [view]);

  const toSettings = (section?: string) => go({ view: 'settings', section });
  const toEditor = () => go({ view: 'day-editor' });
  // The header is the same on every page, so are its buttons.
  const nav: Nav = {
    onProfiles: () => openProfilePicker(toSettings),
    onSettings: toSettings,
    onSummary: () => go({ view: 'summary' }),
    onReset: confirmReset,
    onFullscreen: toggleFullscreen,
    onQuit: quit,
  };
  return (
    <>
      {view === 'main' && <Main nav={nav} onDayEditor={toEditor} />}
      {view === 'settings' && <Settings nav={nav} section={route.section} onBack={up} onDayEditor={toEditor} />}
      {view === 'summary' && <Summary nav={nav} onBack={up} onDayEditor={toEditor} />}
      {view === 'day-editor' && <DayEditor nav={nav} onBack={up} />}
      <ScrollTop />
      <HoverTip />
      <ModalHost />
    </>
  );
}

/** The app, re-mounted when the language changes (Settings → Device → Language), so every string is redrawn. */
function Root() {
  const [version, setVersion] = useState(0);
  useEffect(() => onLocaleChange(() => setVersion((v) => v + 1)), []);
  return <App key={version} />;
}

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

/**
 * The open profile's theme as CSS custom properties on <html>. They are mirrored to localStorage (both themes under
 * Follow system) so the inline script in index.html applies them before the first paint.
 */
function applyTheme() {
  const s = state.profile.settings;
  const vars = cssVars(resolveTheme(s, state.themes, darkQuery.matches));
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  const mirror = s.themeMode === 'fixed'
    ? { fixed: vars }
    : { light: cssVars(findTheme(state.themes, s.lightThemeId, false)), dark: cssVars(findTheme(state.themes, s.darkThemeId, true)) };
  if (DEMO) return; // the mirror is the real app's
  try {
    localStorage.setItem('theme-vars', JSON.stringify(mirror));
  } catch {}
}

/** The daily "how is it used" event: counts as ranges and fixed setting values, no names. */
const usageSnapshot = () => {
  const s = state.profile.settings;
  return {
    activities: bucket(state.activities.filter((a) => !a.archived).length),
    groups: bucket(state.groups.length),
    categories: bucket(state.categories.length),
    profiles: bucket(state.profiles.length),
    layout: s.layout,
    themeMode: s.themeMode,
    installed: matchMedia('(display-mode: standalone)').matches,
  };
};

async function start() {
  if (!DEMO) navigator.storage?.persist?.();
  // The PWA's service worker (public/app/sw.js): installable without the browser's address bar, and offline. Not in dev
  // or the single file (file:// has none).
  if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker unavailable:', e.message));
  }
  // The language first: the first-run seed names (init) and the first render use it.
  await initLocale();
  await init();
  applyTheme();
  startStats();
  trackDaily('usage', usageSnapshot);
  // Follow system: switch with the OS setting (notify re-renders what shows the current theme).
  darkQuery.addEventListener('change', notify);
  subscribe((ev, payload) => {
    if (ev === 'change') {
      applyTheme();
      syncWakeLock();
    }
    if (ev === 'dayClosed' && payload && state.profile.settings.autoExport) {
      const profile = state.profiles.length > 1 ? `${slug(payload.profile)}-` : '';
      download(`activity-day-${profile}${isoDay(payload.day.startedAt)}.json`, payload);
    }
  });

  // Full screen needs a user gesture, so "start in full screen" kicks in on the first tap.
  if (state.profile.settings.startFullscreen) {
    document.addEventListener('pointerdown', () => !document.fullscreenElement && toggleFullscreen(), { once: true });
  }

  setInterval(() => checkRollover(), 1000);

  render(<Root />, document.getElementById('app')!);
  document.addEventListener('visibilitychange', syncWakeLock);
  syncWakeLock();
}

/** Document full screen. Esc is captured (Keyboard Lock) so it stays "back"; holding Esc leaves full screen. */
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
      await (navigator as Navigator & { keyboard?: { lock?: (keys: string[]) => Promise<void> } }).keyboard?.lock?.(['Escape']);
    }
  } catch (e) {
    console.warn('Full screen unavailable:', (e as Error).message);
  }
}

/** The running activity's name, or null while idle. */
const runningName = () => {
  const open = activeSegment();
  return open ? activityById(open.activityId)?.name ?? t('dialogs.theActivity') : null;
};

async function confirmReset() {
  const name = runningName();
  const ok = await confirmDialog({
    title: t('dialogs.resetTitle'),
    body: `${name ? `${t('dialogs.resetStops', { name })} ` : ''}${t('dialogs.resetBody', { date: fmtDayShort(state.day.startedAt), total: fmtHours(todayTotal()) })}`,
    ok: t('header.reset'), danger: true,
  });
  if (ok) resetDay();
}

async function quit() {
  const name = runningName();
  const ok = await confirmDialog({
    title: t('dialogs.closeTitle'),
    body: name ? t('dialogs.closeRunning', { name }) : t('dialogs.closeIdle'),
    ok: t('header.close'),
  });
  if (!ok) return;
  window.close();
  // Browsers only let scripts close app windows / script-opened tabs; tell the user otherwise.
  setTimeout(() => messageDialog(
    t('dialogs.closeYourself'),
    `${t('dialogs.closeYourselfBody')}${name ? ` ${t('dialogs.keepsCounting', { name })}` : ''}`,
  ), 300);
}

/**
 * Hold a screen Wake Lock while Settings → Keep the screen on is set and the page is visible. The browser drops the
 * lock when the page is hidden, so this runs again on visibilitychange. `wakeLock` is the pending/held request.
 */
let wakeLock: Promise<WakeLockSentinel | undefined> | null = null;
async function syncWakeLock() {
  if (!('wakeLock' in navigator)) return;
  const want = state.profile.settings.keepAwake && document.visibilityState === 'visible';
  if (want && !wakeLock) {
    const req: Promise<WakeLockSentinel | undefined> = navigator.wakeLock.request('screen').then(
      (lock) => {
        lock.addEventListener('release', () => wakeLock === req && (wakeLock = null));
        return lock;
      },
      (e) => {
        console.warn('Wake lock unavailable:', e.message);
        if (wakeLock === req) wakeLock = null;
        return undefined;
      },
    );
    wakeLock = req;
  } else if (!want && wakeLock) {
    const req = wakeLock;
    wakeLock = null;
    (await req)?.release();
  }
}

start();
