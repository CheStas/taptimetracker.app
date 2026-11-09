// The mini window (SPEC §11): an always-on-top Document Picture-in-Picture window with what is running, today's total
// and Previous / Stop / Next. Desktop Chrome and Edge only; elsewhere every entry point is hidden.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { activeSegment, activityById, cycleActivity, state as appState, stopActive, todayTotal, visibleActivities } from '../state.ts';
import { slotColor } from '../theme.ts';
import { fmtDur, fmtHMS } from './util.ts';
import { Icon } from './icons.tsx';
import { useAppState } from './hooks.tsx';
import { onLocaleChange, t } from '../i18n.ts';

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}
const pipApi = () => (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

export const miniWindowAvailable = () => Boolean(pipApi());

let win: Window | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

/** Whether the mini window is open; re-renders when it opens or closes. */
export function useMiniWindowOpen() {
  const [open, setOpen] = useState(Boolean(win));
  useEffect(() => {
    const fn = () => setOpen(Boolean(win));
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return open;
}

/** Open the mini window, or close it when it is open. Must run from a click: browsers require a user gesture. */
export async function toggleMiniWindow() {
  if (win) return win.close();
  const api = pipApi();
  if (!api) return;
  try {
    const pip = await api.requestWindow({ width: 320, height: 132 });
    win = pip;
    copyStyles(pip.document);
    pip.document.title = t('header.miniWindow');
    pip.document.body.className = 'mini-body';
    pip.addEventListener('pagehide', () => {
      render(null, pip.document.body);
      if (win === pip) win = null;
      changed();
    });
    render(<MiniWindow win={pip} />, pip.document.body);
    changed();
  } catch (e) {
    console.warn('Mini window unavailable:', (e as Error).message);
  }
}

/**
 * The app's stylesheets: linked ones by their absolute address (so url() inside them resolves as in the app), inline
 * ones (the dev server's) as copies.
 */
function copyStyles(doc: Document) {
  for (const sheet of document.styleSheets) {
    if (sheet.href) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      doc.head.append(link);
      continue;
    }
    try {
      const style = doc.createElement('style');
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
      doc.head.append(style);
    } catch {
      // A cross-origin sheet without an address cannot be read; nothing to copy.
    }
  }
}

/** The theme (custom properties on <html>), language and direction, kept in step with the app's document. */
function syncRoot(doc: Document) {
  const from = document.documentElement;
  const to = doc.documentElement;
  if (to.style.cssText !== from.style.cssText) to.style.cssText = from.style.cssText;
  to.lang = from.lang;
  to.dir = from.dir;
}

/** Its own clock, from the mini window's timers: the app's tab may be in the background and throttled. */
function useWinNow(w: Window) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = w.setInterval(() => setNow(Date.now()), 1000);
    return () => w.clearInterval(id);
  }, [w]);
  return now;
}

function MiniWindow({ win: w }: { win: Window }) {
  useAppState();
  const now = useWinNow(w);
  const [, setVersion] = useState(0);
  useEffect(() => onLocaleChange(() => setVersion((v) => v + 1)), []);
  syncRoot(w.document);

  const open = activeSegment();
  const active = open && activityById(open.activityId);
  const canCycle = visibleActivities().length > 0;
  const button = (label: string, icon: 'prev' | 'stop' | 'next', fn: () => void, disabled: boolean) => (
    <button class="icon round" aria-label={label} title={label} disabled={disabled} onClick={fn}><Icon name={icon} /></button>
  );
  return (
    <div class="mini" data-profile={appState.profile.id}>
      <div class={`mini-now${active ? ' active' : ''}`} style={active ? { '--c': slotColor(active.colorSlot) } : undefined}>
        <span class="dot" />
        <span class="mini-name">{open ? active?.name ?? t('header.active') : t('header.idle')}</span>
        {open && <span class="num mini-run">{fmtDur(now - open.start)}</span>}
      </div>
      <div class="mini-bottom">
        <span class="mini-total">
          <span class="k">{t('mini.today')}</span>
          <span class="num">{fmtHMS(todayTotal(now))}</span>
        </span>
        <span class="mini-buttons">
          {button(t('mini.previous'), 'prev', () => cycleActivity(-1), !canCycle)}
          {button(t('mini.stop'), 'stop', () => stopActive(), !open)}
          {button(t('mini.next'), 'next', () => cycleActivity(1), !canCycle)}
        </span>
      </div>
    </div>
  );
}
