// Settings screen: a section list and the sections: profiles, groups, categories (dimensions and options),
// activities (add, rename, group, target, categories, reorder, hide for today, remove/restore/delete), appearance
// (theme, activity colors, main screen), day, device, backup and about.
import { useEffect, useState } from 'preact/hooks';
import {
  addActivities, updateActivity, renameActivity, moveActivity, removeActivity, restoreActivity, deleteActivity,
  setHiddenToday, canHideToday, activeSegment, setSetting, exportData, importData,
  addGroups, updateGroup, moveGroup, removeGroup, addProfile, renameProfile, removeProfile, switchProfile,
  pickTheme, addTheme, renameTheme, removeTheme, systemDark,
  addDimension, renameDimension, moveDimension, removeDimension, addOption, updateOption, moveOption, removeOption,
  setActivityOption, optionOf,
} from '../state.ts';
import type { ComponentChildren } from 'preact';
import type { Activity, Dimension, Group, Profile, WeekStart } from '../types.ts';
import { findTheme, lowContrastSlots, parseThemeFile, slotColor, themeFile, SLOT_NAMES, type Theme } from '../theme.ts';
import { resolveWeekStart } from '../stats.ts';
import { download, isoDay, fmtSwitch, slug } from './util.ts';
import { Icon } from './icons.tsx';
import { AboutLinks, LayoutSwitch, MAIN_TOGGLES, PrivacyNote, UsageStats, VERSION, currentTheme, toggleHint, toggleLabel } from './about.tsx';
import { AppHeader, type Nav } from './header.tsx';
import { Footer } from './footer.tsx';
import { confirmDialog, useAppState } from './hooks.tsx';
import { APP_LOCALES, intlLocale, locale, seedName, setLocale, t, tn, tx, type Key } from '../i18n.ts';
import { LOCALES } from '../locale.ts';

const MIN_SWITCH = [0, 15, 30, 60, 120, 180, 300];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Section ids (also the #/settings/<id> routes); their names come from settings.sections.<id>. */
const SECTIONS = ['profiles', 'groups', 'categories', 'activities', 'appearance', 'day', 'device', 'backup', 'about'] as const;
const WEEK_STARTS: WeekStart[] = ['system', 1, 0, 6];
/** A weekday's name in the app's language, capitalized (0 = Sunday; 7 Jan 2024 was a Sunday). */
const weekdayName = (w: number) => {
  const name = new Date(2024, 0, 7 + w).toLocaleDateString(intlLocale(), { weekday: 'long' });
  return name.charAt(0).toLocaleUpperCase(intlLocale()) + name.slice(1);
};
const slotLabel = (i: number) => t('settings.colors.slot', { n: i + 1, name: t(`slots.${SLOT_NAMES[i]}` as Key) });

/** Confirm a destructive action in the shared dialog. */
const confirmDanger = (title: string, body: string, ok = t('common.delete')) => confirmDialog({ title, body, ok, danger: true });
const sectionId = (id: string) => id;
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function Settings({ nav, onBack, onDayEditor, section }: { nav: Nav; onBack: () => void; onDayEditor: () => void; section?: string }) {
  const state = useAppState();
  const s = state.profile.settings;
  const live = state.activities.filter((a) => !a.archived);
  const removed = state.activities.filter((a) => a.archived && !a.deleted);
  const current = useCurrentSection(section);

  /** Submit handler for a one-field form: passes the trimmed field value, then clears the form. */
  const onAdd = (fn: (text: string) => void) => (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const text = (form.elements.namedItem('names') as HTMLInputElement).value.trim();
    if (text) fn(text);
    form.reset();
  };

  const onImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !(await confirmDanger(t('settings.backup.importTitle'), t('settings.backup.importBody', { name: state.profile.name }), t('settings.backup.importOk')))) return;
    try {
      await importData(JSON.parse(await file.text()));
      alert(t('settings.backup.importDone'));
    } catch (err) {
      alert(t('settings.importFailed', { error: (err as Error).message }));
    }
  };

  return (
    <div class="settings-page">
      <AppHeader nav={nav} page="settings" title={t('settings.title')} onBack={onBack} />
      <div class="settings-layout">
        <nav class="section-nav" aria-label={t('settings.sectionsLabel')}>
          {SECTIONS.map((n) => (
            <button key={n} class="nv" aria-current={current === sectionId(n) ? 'true' : undefined} onClick={() => scrollTo(sectionId(n))}>{t(`settings.sections.${n}`)}</button>
          ))}
        </nav>
        <div class="settings-main">
          <section id="profiles">
            <h2>{t('settings.sections.profiles')}</h2>
            <p class="muted">{t('settings.profiles.intro')}</p>
            <ul class="act-list">
              {state.profiles.map((p) => <ProfileRow key={p.id} p={p} />)}
            </ul>
            <form class="row" onSubmit={onAdd(addProfile)}>
              <input name="names" type="text" class="grow" placeholder={t('settings.profiles.placeholder')} />
              <button class="primary">{t('settings.profiles.add')}</button>
            </form>
          </section>
          <section id="groups">
            <h2>{t('settings.sections.groups')}</h2>
            <p class="muted">{t('settings.groups.intro')}</p>
            <ul class="act-list">
              {state.groups.map((g, i) => <GroupRow key={g.id} g={g} first={i === 0} last={i === state.groups.length - 1} />)}
            </ul>
            <form class="row" onSubmit={onAdd(addGroups)}>
              <textarea name="names" rows={1} placeholder={t('settings.groups.placeholder')} />
              <button class="primary">{t('common.add')}</button>
            </form>
          </section>
          <section id="categories">
            <h2>{t('settings.sections.categories')}</h2>
            <p class="muted">{t('settings.categories.intro')}</p>
            {state.categories.length === 0 ? (
              <div class="empty-dims">
                <strong>{t('settings.categories.empty')}</strong>
                <span class="muted">{tx('settings.categories.example', {
                  focus: <strong>{seedName('Focus')}</strong>, company: <strong>{seedName('Company')}</strong>,
                  productive: seedName('Productive'), nonProductive: seedName('Non-productive'), people: seedName('With people'), alone: seedName('Alone'),
                })}</span>
                <div class="row-buttons">
                  <button class="primary" onClick={() => addDimension(seedName('Focus'), [{ name: seedName('Productive'), colorSlot: 1 }, { name: seedName('Non-productive'), colorSlot: 7 }])}>
                    {t('settings.categories.addExample', { name: seedName('Focus') })}
                  </button>
                  <button class="secondary" onClick={() => addDimension(t('settings.categories.newName'))}>{t('settings.categories.addEmpty')}</button>
                </div>
              </div>
            ) : state.categories.map((d, i) => <DimensionCard key={d.id} d={d} first={i === 0} last={i === state.categories.length - 1} />)}
            <form class="row" onSubmit={onAdd((name) => addDimension(name))}>
              <input name="names" type="text" class="grow" placeholder={t('settings.categories.placeholder')} aria-label={t('settings.categories.newName')} />
              <button class="primary">{t('settings.categories.add')}</button>
            </form>
          </section>
          <section id="activities">
            <h2>{t('settings.sections.activities')}</h2>
            <ul class="act-list">
              {live.map((a, i) => <ActivityRow key={a.id} a={a} first={i === 0} last={i === live.length - 1} />)}
            </ul>
            <form class="row" onSubmit={onAdd((text) => {
              const taken = addActivities(text);
              if (taken.length) alert(t('settings.activities.taken', { names: taken.join(', ') }));
            })}>
              <textarea name="names" rows={2} placeholder={t('settings.activities.placeholder')} />
              <button class="primary">{t('common.add')}</button>
            </form>
            {removed.length > 0 && <>
              <h3>{t('settings.activities.removedTitle')}</h3>
              <p class="muted">{t('settings.activities.removedIntro')}</p>
              <ul class="act-list">
                {removed.map((a) => (
                  <li key={a.id}>
                    <span class="sq" style={{ background: slotColor(a.colorSlot) }} /><span class="grow">{a.name}</span>
                    <button onClick={() => restoreActivity(a.id)}>{t('settings.activities.restore')}</button>
                    <button class="danger" onClick={async () => {
                      if (await confirmDanger(t('settings.activities.deleteTitle', { name: a.name }), t('settings.activities.deleteBody'))) deleteActivity(a.id);
                    }}>{t('common.delete')}</button>
                  </li>
                ))}
              </ul>
            </>}
          </section>
          <section id="appearance">
            <ThemeSection />
            <ActivityColors list={[...live, ...removed]} />
            <div class="subsection" id="main-screen">
              <h2>{t('footer.mainScreen')}</h2>
              <div class="row">
                <span class="row-label">{t('footer.buttons')}</span>
                <LayoutSwitch />
              </div>
              <div class="toggles">
                {MAIN_TOGGLES.map((m) => (
                  <Check key={m.key} checked={Boolean(s[m.key])} onChange={(v) => setSetting(m.key, v as never)} hint={toggleHint(m.key)}>{toggleLabel(m.key)}</Check>
                ))}
              </div>
            </div>
          </section>
          <section id="day">
            <h2>{t('settings.sections.day')}</h2>
            <label class="row"><span class="row-label">{t('settings.day.reset')}</span>
              <select value={String(s.resetHour)} onChange={(e) => setSetting('resetHour', Number(e.currentTarget.value))}>
                {HOURS.map((h) => <option key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </label>
            <div class="row"><span class="row-label">{t('settings.day.weekStart')}</span>
              <div class="segmented" role="group" aria-label={t('settings.day.weekStart')}>
                {WEEK_STARTS.map((w) => (
                  <button key={w} class="seg" aria-pressed={s.weekStart === w} onClick={() => setSetting('weekStart', w)}>
                    {w === 'system' ? t('settings.day.system', { day: weekdayName(resolveWeekStart('system')) }) : weekdayName(w)}
                  </button>
                ))}
              </div>
              <span class="muted">{t('settings.day.weekHint')}</span>
            </div>
            <label class="row"><span class="row-label">{t('settings.day.minSwitch')}</span>
              <select value={String(s.minSwitchSec)} onChange={(e) => setSetting('minSwitchSec', Number(e.currentTarget.value))}>
                {MIN_SWITCH.map((sec) => <option key={sec} value={String(sec)}>{fmtSwitch(sec)}</option>)}
              </select>
              <span class="muted">{t('settings.day.minSwitchHint')}</span>
            </label>
            <div class="toggles">
              <Check checked={s.autoExport} onChange={(v) => setSetting('autoExport', v)} hint={t('settings.day.autoExportHint')}>
                {t('settings.day.autoExport')}
              </Check>
            </div>
            <div class="row"><button onClick={onDayEditor}>{t('settings.day.editTimeline')}</button></div>
          </section>
          <section id="device">
            <h2>{t('settings.sections.device')}</h2>
            <label class="row"><span class="row-label">{t('settings.device.language')}</span>
              <select value={locale()} onChange={(e) => setLocale(e.currentTarget.value)}>
                {LOCALES.filter((l) => APP_LOCALES.includes(l.code)).map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>)}
              </select>
              <span class="muted">{t('settings.device.languageHint')}</span>
            </label>
            <div class="toggles">
              <Check checked={s.startFullscreen} onChange={(v) => setSetting('startFullscreen', v)} hint={t('settings.device.fullscreenHint')}>
                {t('settings.device.fullscreen')}
              </Check>
              <Check
                checked={s.keepAwake} onChange={(v) => setSetting('keepAwake', v)}
                hint={t('wakeLock' in navigator ? 'settings.device.awakeHint' : 'settings.device.awakeUnavailable')}
              >
                {t('settings.device.awake')}
              </Check>
            </div>
          </section>
          <section id="backup">
            <h2>{t('settings.sections.backup')}</h2>
            <PrivacyNote />
            <p class="muted">{t('settings.backup.intro')}</p>
            <div class="row">
              <button onClick={async () => download(`time-tracker-${slug(state.profile.name)}-${isoDay(Date.now())}.json`, await exportData())}>{t('settings.backup.export')}</button>
              <label class="button">{t('settings.backup.import')}<input type="file" accept="application/json" hidden onChange={onImport} /></label>
            </div>
          </section>
          <section id="about">
            <h2>{t('settings.sections.about')}</h2>
            <div class="row"><AboutLinks variant="settings" /></div>
            <UsageStats />
            <p class="muted num small">Tap Time Tracker · {VERSION}</p>
          </section>
        </div>
      </div>
      <Footer onSettings={nav.onSettings} />
    </div>
  );
}

/** The section in view (the last one whose top has scrolled past the top area); scrolls to `initial` once. */
function useCurrentSection(initial?: string) {
  const [current, setCurrent] = useState<string>(initial ?? sectionId(SECTIONS[0]));
  useEffect(() => {
    if (initial) document.getElementById(initial)?.scrollIntoView({ block: 'start' });
    const onScroll = () => {
      const ids = SECTIONS.map(sectionId);
      // At the very bottom the last sections cannot reach the top; pick the last one then.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const passed = ids.filter((id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 120);
      setCurrent(atEnd ? ids[ids.length - 1] : passed[passed.length - 1] ?? ids[0]);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return current;
}

function ThemeSection() {
  const state = useAppState();
  const s = state.profile.settings;
  const current = currentTheme();
  const name = (id: string, dark: boolean) => findTheme(state.themes, id, dark).name;

  const onImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const theme = addTheme(parseThemeFile(await file.text(), file.name));
      pickTheme(theme.id);
      const low = lowContrastSlots(theme);
      if (low.length) {
        alert(t('settings.theme.lowContrast', { name: theme.name, slots: low.map(slotLabel).join(', ') }));
      }
    } catch (err) {
      alert(t('settings.importFailed', { error: (err as Error).message }));
    }
  };

  return (
    <div class="subsection" id="theme">
      <div class="section-head">
        <div>
          <h2>{t('footer.theme')}</h2>
          <p class="muted">{t('settings.theme.intro')}</p>
        </div>
        <div class="segmented" role="group" aria-label={t('settings.theme.mode')}>
          <button class="seg" aria-pressed={s.themeMode === 'fixed'} onClick={() => setSetting('themeMode', 'fixed')}>{t('settings.theme.fixed')}</button>
          <button class="seg" aria-pressed={s.themeMode === 'system'} onClick={() => setSetting('themeMode', 'system')}>{t('settings.theme.system')}</button>
        </div>
      </div>
      <div class="theme-grid">
        {state.themes.map((th) => <ThemeCard key={th.id} t={th} on={th.id === current.id} />)}
        <label class="import-card">
          <Icon name="upload" />
          <strong>{t('settings.theme.import')}</strong>
          <span class="small">VS Code .json, base16, Alacritty, iTerm</span>
          <input type="file" accept=".json,.yaml,.yml,.toml,.itermcolors,application/json" class="visually-hidden" onChange={onImport} />
        </label>
      </div>
      {s.themeMode === 'system' && (
        <p class="muted">{tx('settings.theme.systemNote', {
          light: <strong>{name(s.lightThemeId, false)}</strong>, dark: <strong>{name(s.darkThemeId, true)}</strong>,
          mode: t(systemDark() ? 'settings.theme.dark' : 'settings.theme.light'),
        })}</p>
      )}
    </div>
  );
}

/** A theme card: a mini preview (background, surface, a filled tile, the 16 slots), name and kind. */
function ThemeCard({ t: theme, on }: { t: Theme; on: boolean }) {
  const c = theme.colors;
  return (
    <div class="theme-card-wrap">
      <button class="theme-card" aria-pressed={on} onClick={() => pickTheme(theme.id)}>
        <span class="preview" aria-hidden="true" style={{ background: c.bg, borderColor: c.line }}>
          <span class="pv-head"><i style={{ background: c.text, width: 34 }} /><i style={{ background: c.muted, width: 18 }} /></span>
          <span class="pv-tiles">
            <i style={{ background: theme.slots[1], flex: 2 }} />
            <i style={{ background: c.surface, borderColor: c.line }} />
            <i style={{ background: c.surface, borderColor: c.line }} />
          </span>
          <span class="pv-slots">{theme.slots.map((s, i) => <i key={i} style={{ background: s }} />)}</span>
        </span>
        <span class="card-foot"><strong>{theme.name}</strong><span class="muted small">{t(theme.kind === 'dark' ? 'settings.theme.dark' : 'settings.theme.light')}</span></span>
      </button>
      {!theme.builtin && (
        <div class="card-actions">
          <button onClick={() => {
            const name = prompt(t('settings.theme.name'), theme.name)?.trim();
            if (name) renameTheme(theme.id, name);
          }}>{t('common.rename')}</button>
          <button onClick={() => download(`${slug(theme.name)}.json`, themeFile(theme))}>{t('settings.theme.export')}</button>
          <button class="danger" onClick={async () => {
            if (await confirmDanger(t('settings.theme.deleteTitle', { name: theme.name }), t('settings.theme.deleteBody'))) removeTheme(theme.id);
          }}>{t('common.delete')}</button>
        </div>
      )}
    </div>
  );
}

/** The 16 slot swatches (two rows of 8 on narrow screens); a tap picks one. */
function SlotSwatches({ value, label, onPick }: { value: number; label: string; onPick: (slot: number) => void }) {
  return (
    <span class="slots" role="group" aria-label={label}>
      {SLOT_NAMES.map((n, i) => (
        <button key={n} class="slot" aria-label={slotLabel(i)} title={slotLabel(i)} aria-pressed={value === i} onClick={() => onPick(i)}>
          <span style={{ background: slotColor(i) }} />
        </button>
      ))}
    </span>
  );
}

/** One row per activity with the 16 slot swatches. */
function ActivityColors({ list }: { list: Activity[] }) {
  return (
    <div class="subsection" id="colors">
      <div>
        <h2>{t('settings.colors.title')}</h2>
        <p class="muted">{t('settings.colors.intro')}</p>
      </div>
      <div class="list-card">
        {list.map((a) => (
          <div key={a.id} class="color-row">
            <span class="color-name"><span class="sq" style={{ background: slotColor(a.colorSlot) }} />{a.name}{a.archived && <span class="muted"> {t('editor.removed')}</span>}</span>
            <SlotSwatches value={a.colorSlot} label={t('settings.colors.of', { name: a.name })} onPick={(i) => updateActivity(a.id, { colorSlot: i })} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A dimension: name, how many activities have an option of it, reorder and delete; its options; add an option. */
function DimensionCard({ d, first, last }: { d: Dimension; first: boolean; last: boolean }) {
  const state = useAppState();
  const [openColor, setOpenColor] = useState<string | null>(null);
  const live = state.activities.filter((a) => !a.archived);
  const set = live.filter((a) => optionOf(a, d)).length;
  return (
    <div class="dim-card">
      <div class="dim-head">
        <label class="dim-name">
          <span class="muted small">{t('settings.categories.dimension')}</span>
          <input
            key={`name:${d.name}`} type="text" defaultValue={d.name} aria-label={t('settings.categories.dimensionName')}
            onChange={(e) => {
              const name = e.currentTarget.value.trim();
              if (name) renameDimension(d.id, name);
            }}
          />
        </label>
        <span class="muted small">{tn('settings.categories.set', live.length, { set })}</span>
        <button disabled={first} aria-label={t('settings.up')} onClick={() => moveDimension(d.id, -1)}>↑</button>
        <button disabled={last} aria-label={t('settings.down')} onClick={() => moveDimension(d.id, 1)}>↓</button>
        <button class="danger" onClick={async () => {
          if (await confirmDanger(t('settings.categories.deleteTitle', { name: d.name }), t('settings.categories.deleteBody'))) removeDimension(d.id);
        }}>{t('common.delete')}</button>
      </div>
      {d.options.map((o, i) => {
        const count = live.filter((a) => a.categories?.[d.id] === o.id).length;
        const open = openColor === o.id;
        return (
          <div key={o.id} class="opt-row">
            <button class="opt-color" aria-label={t('settings.categories.colorOf', { name: o.name, color: t(`slots.${SLOT_NAMES[o.colorSlot]}` as Key) })} aria-expanded={open} onClick={() => setOpenColor(open ? null : o.id)}>
              <span style={{ background: slotColor(o.colorSlot) }} />
            </button>
            <input
              key={`name:${o.name}`} type="text" class="grow" defaultValue={o.name} aria-label={t('settings.categories.optionName')}
              onChange={(e) => {
                const name = e.currentTarget.value.trim();
                if (name) updateOption(d.id, o.id, { name });
              }}
            />
            <span class="muted small opt-count">{tn('settings.activityCount', count)}</span>
            <button disabled={i === 0} aria-label={t('settings.up')} onClick={() => moveOption(d.id, o.id, -1)}>↑</button>
            <button disabled={i === d.options.length - 1} aria-label={t('settings.down')} onClick={() => moveOption(d.id, o.id, 1)}>↓</button>
            <button class="danger ghost" onClick={async () => {
              if (await confirmDanger(t('settings.categories.deleteOptionTitle', { name: o.name }), t('settings.categories.deleteOptionBody', { dimension: d.name }))) removeOption(d.id, o.id);
            }}>{t('common.delete')}</button>
            {open && (
              <div class="opt-swatches">
                <SlotSwatches value={o.colorSlot} label={t('settings.colors.of', { name: o.name })} onPick={(slot) => updateOption(d.id, o.id, { colorSlot: slot })} />
              </div>
            )}
          </div>
        );
      })}
      <form class="opt-add" onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const name = (form.elements.namedItem('names') as HTMLInputElement).value.trim();
        if (name) addOption(d.id, name);
        form.reset();
      }}>
        <input name="names" type="text" class="grow" placeholder={t('settings.categories.addOption')} aria-label={t('settings.categories.newOption')} />
        <button class="primary">{t('common.add')}</button>
      </form>
    </div>
  );
}

/** An activity's option of a dimension: a segmented control for 2–3 options (plus Not set), a list for 4 or more. */
function CategoryPicker({ a, d }: { a: Activity; d: Dimension }) {
  const current = optionOf(a, d)?.id ?? '';
  const opts = [...d.options.map((o) => ({ id: o.id, name: o.name, color: slotColor(o.colorSlot) })), { id: '', name: t('summary.notSet'), color: 'var(--line-2)' }];
  return (
    <div class="cat-picker" role="group" aria-label={d.name}>
      <span class="muted small cat-label">{d.name}</span>
      {d.options.length <= 3 ? (
        <span class="segmented">
          {opts.map((o) => (
            <button key={o.id} class="seg small" aria-pressed={current === o.id} onClick={() => setActivityOption(a.id, d.id, o.id || null)}>
              <span class="dot" style={{ background: o.color }} />{o.name}
            </button>
          ))}
        </span>
      ) : (
        <span class="chip-select">
          <span class="dot" style={{ background: opts.find((o) => o.id === current)!.color }} />
          <select value={current} aria-label={d.name} onChange={(e) => setActivityOption(a.id, d.id, e.currentTarget.value || null)}>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <Icon name="chevronDown" />
        </span>
      )}
    </div>
  );
}

function Check({ checked, onChange, hint, children }: { checked: boolean; onChange: (v: boolean) => void; hint?: string; children: ComponentChildren }) {
  return (
    <label class="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="toggle-text"><span>{children}</span>{hint && <span class="muted small">{hint}</span>}</span>
    </label>
  );
}

function ProfileRow({ p }: { p: Profile }) {
  const state = useAppState();
  const isOpen = p.id === state.profile.id;
  return (
    <li>
      <input
        key={`name:${p.name}`} type="text" defaultValue={p.name} aria-label={t('settings.profiles.name')}
        onChange={(e) => {
          const name = e.currentTarget.value.trim();
          if (name) renameProfile(p.id, name);
        }}
      />
      {isOpen ? <span class="badge">{t('settings.profiles.isOpen')}</span> : <button onClick={() => switchProfile(p.id)}>{t('profiles.open')}</button>}
      <button class="danger" disabled={isOpen} title={isOpen ? t('settings.profiles.openOther') : ''} onClick={async () => {
        if (await confirmDanger(t('settings.profiles.deleteTitle', { name: p.name }), t('settings.profiles.deleteBody'))) {
          removeProfile(p.id);
        }
      }}>{t('common.delete')}</button>
    </li>
  );
}

function GroupRow({ g, first, last }: { g: Group; first: boolean; last: boolean }) {
  const state = useAppState();
  const count = state.activities.filter((a) => a.groupId === g.id && !a.archived).length;
  return (
    <li>
      <input
        key={`name:${g.name}`} type="text" defaultValue={g.name} aria-label={t('settings.groups.name')}
        onChange={(e) => {
          const name = e.currentTarget.value.trim();
          if (name) updateGroup(g.id, { name });
        }}
      />
      <span class="muted">{tn('settings.activityCount', count)}</span>
      <label class="check">
        <input type="checkbox" checked={g.on} onChange={(e) => updateGroup(g.id, { on: e.currentTarget.checked })} />
        {t('settings.groups.on')}
      </label>
      <button disabled={first} aria-label={t('settings.up')} onClick={() => moveGroup(g.id, -1)}>↑</button>
      <button disabled={last} aria-label={t('settings.down')} onClick={() => moveGroup(g.id, 1)}>↓</button>
      <button class="danger" onClick={async () => {
        if (await confirmDanger(t('settings.groups.deleteTitle', { name: g.name }), t('settings.groups.deleteBody'))) removeGroup(g.id);
      }}>{t('common.delete')}</button>
    </li>
  );
}

/** Text fields use defaultValue keyed by the stored value, so a re-render never clobbers what is being typed. */
function ActivityRow({ a, first, last }: { a: Activity; first: boolean; last: boolean }) {
  const state = useAppState();
  const hidden = a.hiddenForDayId === state.day.id;
  const hideable = hidden || (canHideToday(a.id) && a.id !== activeSegment()?.activityId);
  return (
    <li>
      <button class="swatch-link" aria-label={t('settings.activities.colorLabel', { name: a.name })} title={t('settings.activities.colorTitle')} onClick={() => scrollTo('colors')}>
        <span class="sq" style={{ background: slotColor(a.colorSlot) }} />
      </button>
      <input
        key={`name:${a.name}`} type="text" defaultValue={a.name} aria-label={t('settings.activities.name')}
        onChange={(e) => {
          const input = e.currentTarget;
          const name = input.value.trim();
          if (!name || name === a.name) return void (input.value = a.name);
          if (!renameActivity(a.id, name)) {
            alert(t('settings.activities.exists', { name }));
            input.value = a.name;
          }
        }}
      />
      {state.groups.length > 0 && (
        <select value={a.groupId ?? ''} aria-label={t('settings.activities.group')} onChange={(e) => updateActivity(a.id, { groupId: e.currentTarget.value || null })}>
          <option value="">{t('settings.activities.noGroup')}</option>
          {state.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      <label class="target-in">{t('settings.activities.target')}
        <input
          key={`target:${a.targetMin}`} type="number" min="0" step="5" placeholder="–" defaultValue={String(a.targetMin ?? '')}
          onChange={(e) => updateActivity(a.id, { targetMin: Number(e.currentTarget.value) || null })}
        /> {t('settings.activities.min')}
      </label>
      <label class={`check${hideable ? '' : ' disabled'}`} title={hideable ? '' : t('settings.activities.hasTime')}>
        <input type="checkbox" checked={hidden} disabled={!hideable} onChange={(e) => setHiddenToday(a.id, e.currentTarget.checked)} />
        {t('settings.activities.hideToday')}{!hideable && <> <span class="muted">({t('settings.activities.hasTime')})</span></>}
      </label>
      <button disabled={first} aria-label={t('settings.up')} onClick={() => moveActivity(a.id, -1)}>↑</button>
      <button disabled={last} aria-label={t('settings.down')} onClick={() => moveActivity(a.id, 1)}>↓</button>
      <button class="danger" aria-label={t('settings.activities.remove')} onClick={async () => {
        if (await confirmDanger(t('settings.activities.removeTitle', { name: a.name }), t('settings.activities.removeBody'), t('settings.activities.remove'))) removeActivity(a.id);
      }}>{t('settings.activities.remove')}</button>
      {state.categories.length > 0 && (
        <div class="cat-pickers">{state.categories.map((d) => <CategoryPicker key={d.id} a={a} d={d} />)}</div>
      )}
    </li>
  );
}
