// The "about" links (footer, welcome strip, Settings → About), the quick theme and main screen switches, the privacy
// note and the usage stats switch. "What is it?" and "Similar apps" open the site's pages (placeholders in the
// single-file build); "Send feedback" opens the feedback form.
import type { ComponentChildren } from 'preact';
import { state, pickTheme, systemDark, setSetting } from '../state.ts';
import { resolveTheme, type Theme } from '../theme.ts';
import type { Layout } from '../types.ts';
import { Icon, type IconName } from './icons.tsx';
import { messageDialog } from './hooks.tsx';
import { openFeedback } from './feedback.tsx';
import { browserOptsOut, setStatsOn, statsAvailable, statsChoice, statsOn } from '../analytics.ts';
import { useState } from 'preact/hooks';
import { locale, t, type Key } from '../i18n.ts';

export const VERSION = `v${__APP_VERSION__}`;

// The site pages sit next to the app (app/ → ../), English at the root and other languages under their code; the
// app links to its own language's page where there is one. The single-file build has no site around it.
const SITE = import.meta.env.MODE === 'single' ? null : '../';
const sitePage = (path: string) => `${SITE}${locale() !== 'en' && __SITE_PAGES__[path]?.includes(locale()) ? `${locale()}/` : ''}${path}`;

const LINKS: { id: string; label: Key; path?: string }[] = [
  { id: 'what', label: 'about.what', path: '' },
  { id: 'compare', label: 'about.similar', path: 'similar/' },
  { id: 'feedback', label: 'about.feedback' },
];

const openLink = (link: (typeof LINKS)[number]) => link.id === 'feedback'
  ? openFeedback(VERSION)
  : messageDialog(t(link.label), t('about.offline'));

/** The three links (a page link, or a button for a placeholder); `variant` picks the look of the place they are in. */
export function AboutLinks({ variant }: { variant: 'strip' | 'footer' | 'settings' }) {
  return (
    <>
      {LINKS.map((l) => {
        const content = (
          <>
            {variant === 'footer' && l.id === 'feedback' && <Icon name="feedback" />}
            {t(l.label)}
          </>
        );
        return SITE && l.path !== undefined
          ? <a key={l.id} class={`lnk lnk-${variant}`} href={sitePage(l.path)}>{content}</a>
          : <button key={l.id} class={`lnk lnk-${variant}`} onClick={() => openLink(l)}>{content}</button>;
      })}
    </>
  );
}

/** The theme the open profile shows right now. */
export const currentTheme = () => resolveTheme(state.profile.settings, state.themes, systemDark());

/** One round swatch per installed theme (background + two activity colors); a tap applies it. */
export function ThemeSwatches({ compact }: { compact?: boolean }) {
  const current = currentTheme();
  return (
    <div class={`swatches${compact ? ' compact' : ''}`} role="group" aria-label={t('footer.theme')}>
      {state.themes.map((t: Theme) => (
        <button
          key={t.id} class={`sw${t.id === current.id ? ' on' : ''}`} aria-label={t.name} title={t.name}
          aria-pressed={t.id === current.id} onClick={() => pickTheme(t.id)}
        >
          <span><i style={{ background: t.colors.bg }} /><i style={{ background: t.slots[1] }} /><i style={{ background: t.slots[0] }} /></span>
        </button>
      ))}
    </div>
  );
}

const LAYOUTS: Layout[] = ['tiles', 'rows', 'circles'];
export const layoutName = (id: Layout) => t(`layout.${id}`);

/** Tiles / Rows / Circles (Settings → Main screen and the footer). */
export function LayoutSwitch() {
  const layout = state.profile.settings.layout;
  return (
    <div class="segmented" role="group" aria-label={t('layout.label')}>
      {LAYOUTS.map((id) => (
        <button key={id} class="seg" aria-label={layoutName(id)} title={layoutName(id)} aria-pressed={layout === id} onClick={() => setSetting('layout', id)}>
          <span class={`layout-icon ${id}`} aria-hidden="true"><i /><i /></span><span class="seg-label">{layoutName(id)}</span>
        </button>
      ))}
    </div>
  );
}

/** The main screen toggles; the ones with an icon also sit in the footer as icon toggles. */
export const MAIN_TOGGLES: { key: 'popularity' | 'unusedStrip' | 'showTimeline' | 'showGroups' | 'showFooter'; icon?: IconName }[] = [
  { key: 'popularity', icon: 'sizeByUsage' },
  { key: 'unusedStrip', icon: 'unusedStrip' },
  { key: 'showTimeline' },
  { key: 'showGroups' },
  { key: 'showFooter' },
];
export const toggleLabel = (key: (typeof MAIN_TOGGLES)[number]['key']) => t(`toggles.${key}.label`);
export const toggleHint = (key: (typeof MAIN_TOGGLES)[number]['key']) => t(`toggles.${key}.hint`);

/** Footer: the layout switch and the icon toggles. */
export function MainScreenSwitch() {
  const s = state.profile.settings;
  return (
    <div class="quick-row">
      <LayoutSwitch />
      {MAIN_TOGGLES.filter((m) => m.icon).map((m) => (
        <button
          key={m.key} class="icon round toggle" aria-label={toggleLabel(m.key)} title={toggleLabel(m.key)} aria-pressed={Boolean(s[m.key])}
          onClick={() => setSetting(m.key, !s[m.key] as never)}
        ><Icon name={m.icon!} /></button>
      ))}
    </div>
  );
}

/** Footer and Settings → Backup: the data lives only here, so back it up. */
export function PrivacyNote({ children }: { children?: ComponentChildren }) {
  return (
    <p class="note">
      <strong>{t('about.privacyNote')}</strong>
      {children}
    </p>
  );
}

/** Settings → About: anonymous usage stats, on unless the visitor (or their browser's Do Not Track) said no. */
export function UsageStats() {
  const [on, setOn] = useState(statsOn);
  if (!statsAvailable()) return <p class="muted small">{t('about.statsUnavailable')}</p>;
  const change = (v: boolean) => {
    setStatsOn(v);
    setOn(v);
  };
  return (
    <>
      <div class="toggles">
        <label class="toggle">
          <input type="checkbox" checked={on} onChange={(e) => change(e.currentTarget.checked)} />
          <span class="toggle-text">
            <span>{t('about.statsLabel')}</span>
            <span class="muted small">{t('about.statsHint')}</span>
          </span>
        </label>
      </div>
      <p class="muted small">
        {!statsChoice() && browserOptsOut() && `${t('about.statsDnt')} `}
        {t('about.statsPlea')}{' '}
        <a href="../privacy/" hreflang="en">{t('about.statsLink')}</a>
      </p>
    </>
  );
}
