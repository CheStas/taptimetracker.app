// Day editor: one day's whole timeline (today, or a closed day picked with ‹ ›); edit/delete any segment, add a
// range, or clear the day.
import { useEffect, useState } from 'preact/hooks';
import { state, liveActivities, assignRange, clearDay, dayList, openPastDay } from '../state.ts';
import { duration } from '../timeline.ts';
import type { Day } from '../types.ts';
import { slotColor } from '../theme.ts';
import { fmtDate, fmtDayShort, fmtDur, fmtRange } from './util.ts';
import { TimePicker, clampTime } from './timePicker.tsx';
import { openSessionEditor, confirmDeleteSession } from './activityPopup.tsx';
import { TimelineBar, activityRange, logRows, GapRow, dayLookup } from './summary.tsx';
import { Icon } from './icons.tsx';
import { AppHeader, type Nav } from './header.tsx';
import { Footer } from './footer.tsx';
import { confirmDialog, openModal, useAppState } from './hooks.tsx';
import { t } from '../i18n.ts';

export function DayEditor({ nav, onBack }: { nav: Nav; onBack: () => void }) {
  useAppState();
  const [days, setDays] = useState<Day[]>([]);
  // Reload the list when a new day starts; leaving the editor goes back to today.
  useEffect(() => {
    dayList().then(setDays);
  }, [state.day.id]);
  useEffect(() => () => void openPastDay(null), []);

  const { day, segments } = state.pastDay ?? { day: state.day, segments: state.segments };
  const isToday = day.id === state.day.id;
  const now = day.endedAt ?? Date.now();
  const lookup = dayLookup(day);
  const rows = logRows(segments, now);
  // The bar spans the activities only; idle shows up just between them.
  const [from, to] = segments.length ? activityRange(segments, now) : [0, 0];
  const i = days.findIndex((d) => d.id === day.id);
  const step = (d: Day | undefined) => d && openPastDay(d);

  return (
    <section class="view">
      <AppHeader nav={nav} page="day-editor" title={t('editor.title')} onBack={onBack} />
      <div class="page">
        <nav class="day-step" aria-label={t('editor.day')}>
          <button class="icon round" aria-label={t('editor.prev')} title={t('editor.prev')} disabled={i <= 0} onClick={() => step(days[i - 1])}>
            <Icon name="prev" />
          </button>
          <h2>{isToday ? t('editor.today', { date: fmtDayShort(day.startedAt) }) : fmtDate(day.startedAt)}</h2>
          <button class="icon round" aria-label={t('editor.next')} title={t('editor.next')} disabled={i < 0 || i >= days.length - 1} onClick={() => step(days[i + 1])}>
            <Icon name="next" />
          </button>
        </nav>
        <div>{segments.length > 0 && <TimelineBar from={from} to={to} segments={segments} lookup={lookup} />}</div>
        <ul class="sessions">
          {rows.length ? rows.map(({ seg, gap, t: at }) => {
            if (gap) return <GapRow key={`gap-${at}`} gap={gap} />;
            const a = lookup(seg.activityId);
            return (
              <li key={seg.id}>
                <span class="dot" style={{ '--c': a?.color ?? 'var(--muted)' }} />
                <span class="grow">{a?.name ?? '?'}{a?.removed && <> <span class="muted">{t('editor.removed')}</span></>}</span>
                <span>{fmtRange(seg.start, seg.end)}</span>
                <span class="muted">{fmtDur(duration(seg, now))}</span>
                <button onClick={() => openSessionEditor(seg, day)}>{t('common.edit')}</button>
                <button class="danger" onClick={() => confirmDeleteSession(seg, now)}>{t('common.delete')}</button>
              </li>
            );
          }) : <li class="muted">{t(isToday ? 'editor.noneToday' : 'editor.noneDay')}</li>}
        </ul>
        <div class="row">
          <button class="primary" onClick={() => openModal((close) => <AddRange day={day} close={close} />, { size: 'activity' })}>+ {t('editor.addRange')}</button>
          <button class="danger" onClick={async () => {
            const ok = await confirmDialog({
              title: t(isToday ? 'editor.clearTodayTitle' : 'editor.clearDayTitle'),
              body: t('editor.clearBody'), ok: t('editor.clearOk'), danger: true,
            });
            if (ok) clearDay(day.id);
          }}>{t('editor.clear')}</button>
        </div>
      </div>
      <Footer onSettings={nav.onSettings} />
    </section>
  );
}

/** Add a range to a day; only today can keep it running. */
function AddRange({ day, close }: { day: Day; close: () => void }) {
  const acts = liveActivities();
  const max = day.endedAt ?? undefined;
  const [chosen, setChosen] = useState<string | null>(acts[0]?.id ?? null);
  const [to, setTo] = useState(() => max ?? Date.now());
  const [from, setFrom] = useState(() => clampTime(to - 30 * 60000, day.startedAt, to));
  const [running, setRunning] = useState(false);
  return (
    <div class="dialog-body popup">
      <h2 class="dialog-title">{t('editor.addRange')}</h2>
      <div class="chips">
        {acts.map((a) => (
          <button key={a.id} class={`chip${chosen === a.id ? ' active' : ''}`} style={{ '--c': slotColor(a.colorSlot) }} onClick={() => setChosen(a.id)}>{a.name}</button>
        ))}
        <button class={`chip${chosen === null ? ' active' : ''}`} onClick={() => setChosen(null)}>{t('editor.idleNone')}</button>
      </div>
      <TimePicker value={from} onChange={setFrom} min={day.startedAt} max={max} label={t('editor.from')} />
      <TimePicker value={to} onChange={setTo} min={from} max={max} label={t('editor.to')} disabled={running} />
      {max === undefined && (
        <label class="check">
          <input type="checkbox" checked={running} onChange={(e) => setRunning(e.currentTarget.checked)} /> {t('editor.keepRunning')}
        </label>
      )}
      <div class="dialog-actions">
        <button class="secondary" onClick={close}>{t('common.cancel')}</button>
        <button class="primary" onClick={() => {
          assignRange(chosen, from, running ? null : to, day.id);
          close();
        }}>{t('common.apply')}</button>
      </div>
    </div>
  );
}
