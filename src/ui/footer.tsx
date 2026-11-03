// The app footer at the bottom of every page: the privacy note, about, links, and the quick settings (theme and main
// screen). Shown with Settings → Main screen → Show the footer.
import { AboutLinks, MainScreenSwitch, PrivacyNote, ThemeSwatches, VERSION, currentTheme, layoutName } from './about.tsx';
import { useAppState } from './hooks.tsx';
import { t } from '../i18n.ts';

export function Footer({ onSettings }: { onSettings: (section?: string) => void }) {
  const { showFooter, layout } = useAppState().profile.settings;
  // Without the footer the page still ends in some room, so it can always be scrolled (the phone's browser bars).
  if (!showFooter) return <div class="end-space" />;
  const more = (section: string) => <button class="lnk lnk-muted" onClick={() => onSettings(section)}>{t('footer.more')}</button>;
  return (
    <footer id="footer" class="app-footer">
      <PrivacyNote><button class="lnk lnk-muted" onClick={() => onSettings('backup')}>{t('footer.export')}</button></PrivacyNote>
      <div class="about">
        <strong>Time Tracker</strong>
        <span class="muted">{t('footer.tagline')}</span>
        <span class="muted num small">{VERSION}</span>
      </div>
      <nav aria-label={t('about.label')} class="links"><AboutLinks variant="footer" /></nav>
      <div class="quick">
        <div class="theme-switch" role="group" aria-label={t('footer.theme')}>
          <span class="muted theme-head"><span>{t('footer.theme')} · <strong>{currentTheme().name}</strong></span>{more('appearance')}</span>
          <ThemeSwatches />
        </div>
        <div class="theme-switch" role="group" aria-label={t('footer.mainScreen')}>
          <span class="muted theme-head"><span>{t('footer.buttons')} · <strong>{layoutName(layout)}</strong></span>{more('main-screen')}</span>
          <MainScreenSwitch />
        </div>
      </div>
    </footer>
  );
}
