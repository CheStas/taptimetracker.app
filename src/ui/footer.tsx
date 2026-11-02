// The app footer at the bottom of every page: the privacy note, about, links, and the quick settings (theme and main
// screen). Shown with Settings → Main screen → Show the footer.
import { AboutLinks, MainScreenSwitch, PrivacyNote, ThemeSwatches, VERSION, currentTheme, layoutName } from './about.tsx';
import { useAppState } from './hooks.tsx';

export function Footer({ onSettings }: { onSettings: (section?: string) => void }) {
  const { showFooter, layout } = useAppState().profile.settings;
  // Without the footer the page still ends in some room, so it can always be scrolled (the phone's browser bars).
  if (!showFooter) return <div class="end-space" />;
  const more = (section: string) => <button class="lnk lnk-muted" onClick={() => onSettings(section)}>More in Settings</button>;
  return (
    <footer id="footer" class="app-footer">
      <PrivacyNote><button class="lnk lnk-muted" onClick={() => onSettings('backup')}>Export in Settings</button></PrivacyNote>
      <div class="about">
        <strong>Time Tracker</strong>
        <span class="muted">A chess clock for your work day.</span>
        <span class="muted num small">{VERSION}</span>
      </div>
      <nav aria-label="About" class="links"><AboutLinks variant="footer" /></nav>
      <div class="quick">
        <div class="theme-switch" role="group" aria-label="Theme">
          <span class="muted theme-head"><span>Theme · <strong>{currentTheme().name}</strong></span>{more('appearance')}</span>
          <ThemeSwatches />
        </div>
        <div class="theme-switch" role="group" aria-label="Main screen">
          <span class="muted theme-head"><span>Buttons · <strong>{layoutName(layout)}</strong></span>{more('main-screen')}</span>
          <MainScreenSwitch />
        </div>
      </div>
    </footer>
  );
}
