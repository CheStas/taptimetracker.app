// The site pages' script: anonymous usage stats (src/analytics.ts), on the privacy page the switch for them, and the
// language banner and choice (§21). Both choices are shared with the app (same localStorage).
import { browserOptsOut, setStatsOn, startStats, statsAvailable, statsChoice, statsOn } from '../analytics.ts';
import { preferredLocale, saveLocale } from '../locale.ts';

startStats();

const box = document.getElementById('stats-choice');
function showChoice() {
  if (!box) return;
  if (!statsAvailable()) {
    box.textContent = 'This copy of the site sends no usage stats.';
    return;
  }
  const on = statsOn();
  const dnt = !statsChoice() && browserOptsOut() ? ' Your browser asks sites not to track, so they stay off unless you turn them on.' : '';
  box.textContent = `Usage stats are ${on ? 'on' : 'off'} in this browser.${dnt} `;
  const button = document.createElement('button');
  button.className = 'button';
  button.textContent = on ? 'Turn off' : 'Turn on';
  button.onclick = () => {
    setStatsOn(!on);
    showChoice();
  };
  box.append(button);
}
showChoice();

// ---------- language ----------
const pageLocale = document.documentElement.lang;

// A link to another language (switcher, banner) saves it; a link into the app saves the page's language, so the app
// opens in the language the visitor was reading.
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest?.('a');
  if (!a) return;
  if (a.dataset.locale) saveLocale(a.dataset.locale);
  else if (/(^|\/)app\/(\?|$)/.test(a.getAttribute('href') ?? '')) saveLocale(pageLocale);
});

// The banner: never a redirect, only a suggestion when this page exists in the preferred language (§21.2).
const banners = [...document.querySelectorAll<HTMLElement>('.lang-banner')];
const want = preferredLocale((document.documentElement.dataset.locales ?? '').split(' '));
const banner = banners.find((b) => b.dataset.locale === want);
if (banner && want !== pageLocale) {
  banner.hidden = false;
  banner.querySelector('.close')?.addEventListener('click', () => {
    saveLocale(pageLocale);
    banner.hidden = true;
  });
}

// ---------- not found ----------
// The 404 page times the visit, m:ss, from when it opened.
const lost = document.getElementById('time-lost');
const clock = lost?.querySelector('time');
if (lost && clock) {
  const start = Date.now();
  const tick = () => {
    const s = Math.floor((Date.now() - start) / 1000);
    clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  tick();
  lost.hidden = false;
  setInterval(tick, 1000);
}
