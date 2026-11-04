// Summary: one scrolling page for a period (Day, Week, Month, Custom): the period card with its folded calendar and
// picker, figure tiles, the day timeline or the per-day rows, the share by activity or by a category dimension, and
// the day's sessions. Days run from reset hour to reset hour (src/stats.ts). Also the day bar and session-list helpers
// the day editor uses.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { state, closedHistory, activityById, dimensionById, optionOf, openPastDay, setSetting } from '../state.ts';
import { gaps, duration, type Gap } from '../timeline.ts';
import type { Activity, Day, Dimension, PeriodKind, Segment } from '../types.ts';
import { slotColor } from '../theme.ts';
import {
  splitDays, dayOf, dayStart, dayDate, ymd, dayNum, periodOf, stepPeriod, samePeriod, periodLength, quickRange,
  rangePeriod, resolveWeekStart, periodStats, totalsBy, targetMetDays, dayRows, weekRows, axisRange, axisTicks, heat,
  NOT_SET, QUICK_RANGES, WEEK_ROWS_AFTER, type DayNum, type Period, type Piece, type PeriodStats, type DayStats, type QuickRange,
} from '../stats.ts';
import { fmtClock, fmtHM, fmtHours, fmtHoursShort, fmtRange, fmtDayShort, targetText } from './util.ts';
import { Icon } from './icons.tsx';
import { AppHeader, type Nav } from './header.tsx';
import { Footer } from './footer.tsx';
import { useAppState, useNow } from './hooks.tsx';
import { intlLocale, t, tn, type Key } from '../i18n.ts';

// ---------- shared with the day editor ----------

/** What the timeline and lists need to know about an activity (live, or named by a closed day's snapshot). */
export interface Shown {
  name: string;
  /** A CSS color: the activity's current slot. */
  color: string;
  targetMin?: number | null;
  removed?: boolean;
}
export type Lookup = (id: string) => Shown | undefined;

/** Closed days keep the name and target of their snapshot; the color always follows the activity's current slot. */
export const dayLookup = (day: Day): Lookup => (id) => {
  const live = activityById(id);
  const snap = day.id === state.day.id ? undefined : day.snapshot?.activities?.[id];
  const base = snap ?? live;
  return base && {
    name: base.name, targetMin: base.targetMin, removed: live?.archived ?? !live,
    color: live ? slotColor(live.colorSlot) : snap?.colorSlot !== undefined ? slotColor(snap.colorSlot) : snap?.color ?? 'var(--muted)',
  };
};

/** Range shown for a day: first activity start to last activity end (or `now` while one runs). */
export function activityRange(segments: Segment[], now: number): [number, number] {
  return [Math.min(...segments.map((s) => s.start)), Math.max(...segments.map((s) => s.end ?? now))];
}

type LogRow = { t: number; seg: Segment; gap?: undefined } | { t: number; gap: Gap; seg?: undefined };

/** Segments and the idle gaps between them as one sorted list of {seg} / {gap} rows. */
export function logRows(segments: Segment[], now: number): LogRow[] {
  return [
    ...segments.map((s) => ({ t: s.start, seg: s })),
    ...gaps(segments, now).map((g) => ({ t: g.start, gap: g })),
  ].sort((a, b) => a.t - b.t);
}

export const GapRow = ({ gap }: { gap: Gap }) => (
  <li class="gap muted"><span>{fmtRange(gap.start, gap.end)}</span><span>{t('summary.idleFor', { time: fmtHM(gap.end - gap.start) })}</span></li>
);

/** Horizontal bar: one coloured block per segment, positioned within [from, to], labelled with its duration. */
export function TimelineBar({ from, to, segments, lookup }: { from: number; to: number; segments: Segment[]; lookup: Lookup }) {
  const span = Math.max(to - from, 1);
  return (
    <div class="timeline">
      {segments.map((s) => {
        const a = lookup(s.activityId);
        return (
          <span
            key={s.id}
            title={`${a?.name ?? '?'} ${fmtRange(s.start, s.end).replace(' – ', '–')}`}
            style={{ left: `${((s.start - from) / span) * 100}%`, width: `${(duration(s, to) / span) * 100}%`, background: a?.color ?? 'var(--muted)' }}
          >
            <span class="tl-dur">{fmtHM(duration(s, to))}</span>
          </span>
        );
      })}
      <div class="tl-labels"><span>{fmtClock(from)}</span><span>{fmtClock(to)}</span></div>
    </div>
  );
}

// ---------- labels ----------

const MIN = 60000;
const fmtMD = (n: DayNum) => dayDate(n).toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric' });
const fmtDow = (n: DayNum) => dayDate(n).toLocaleDateString(intlLocale(), { weekday: 'short' });
const fmtMonth = (n: DayNum) => dayDate(n).toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric' });
/** "September", "вересень": the month on its own (standalone form where the language has one). */
const fmtMonthName = (n: DayNum) => new Intl.DateTimeFormat(intlLocale(), { month: 'long' }).format(dayDate(n));
/** "Wed 28" */
const fmtDowDate = (n: DayNum) => `${fmtDow(n)} ${ymd(n)[2]}`;
const days = (n: number) => tn('summary.days', n);

function periodLabel(p: Period, today: DayNum) {
  if (p.kind === 'day') return p.from === today ? t('header.today', { date: fmtDayShort(dayDate(p.from).getTime()) }) : fmtDayShort(dayDate(p.from).getTime());
  if (p.kind === 'month') return fmtMonth(p.from);
  return `${fmtMD(p.from)} – ${fmtMD(p.to)}`;
}

function periodSub(p: Period, today: DayNum) {
  if (p.kind === 'day' || p.kind === 'week') return '';
  const last7 = p.kind === 'custom' && p.to === today && periodLength(p) === 7;
  return `${days(periodLength(p))}${last7 ? ` · ${quickLabel('Last 7 days')}` : ''}`;
}

const QUICK_KEYS: Record<QuickRange, Key> = {
  'Today': 'summary.quick.today', 'Yesterday': 'summary.quick.yesterday', 'This week': 'summary.quick.thisWeek',
  'Last week': 'summary.quick.lastWeek', 'Last 7 days': 'summary.quick.last7', 'This month': 'summary.quick.thisMonth',
  'Last month': 'summary.quick.lastMonth', 'Last 30 days': 'summary.quick.last30',
};
const quickLabel = (q: QuickRange) => t(QUICK_KEYS[q]);
const JUMP: Record<PeriodKind, QuickRange> = { day: 'Today', week: 'This week', month: 'This month', custom: 'Last 7 days' };
const PERIODS: PeriodKind[] = ['day', 'week', 'month', 'custom'];

/** The "vs …" tile's label and its "no data in …" line: one sentence each per period kind, so every language can
 * inflect them ("vs September", "the previous 10 days"). */
function versus(p: Period) {
  if (p.kind === 'month') {
    const month = fmtMonthName(stepPeriod(p, -1).from);
    return { label: t('summary.vsMonth', { month }), none: t('summary.noDataMonth', { month }) };
  }
  if (p.kind === 'week') return { label: t('summary.vsWeek'), none: t('summary.noDataWeek') };
  const n = periodLength(p);
  return { label: tn('summary.vsDays', n), none: tn('summary.noDataDays', n) };
}

// ---------- grouping ----------

/** How blocks, rows and the share are colored and named: by activity, or by the options of one dimension. */
interface Grouping {
  dim: Dimension | null;
  keyOf: (activityId: string) => string;
  name: (key: string) => string;
  color: (key: string) => string;
}

function grouping(dim: Dimension | null): Grouping {
  const actColor = (id: string) => slotColor(activityById(id)?.colorSlot ?? 0);
  if (!dim) return { dim, keyOf: (id) => id, name: (id) => activityById(id)?.name ?? '?', color: actColor };
  const opt = (key: string) => dim.options.find((o) => o.id === key);
  return {
    dim,
    keyOf: (id) => optionOf(activityById(id), dim)?.id ?? NOT_SET,
    name: (key) => opt(key)?.name ?? t('summary.notSet'),
    color: (key) => (opt(key) ? slotColor(opt(key)!.colorSlot) : 'var(--notset)'),
  };
}

const isRemoved = (a: Activity | undefined) => !a || a.archived;

// ---------- the page ----------

export function Summary({ nav, onBack, onDayEditor }: { nav: Nav; onBack: () => void; onDayEditor: () => void }) {
  const state = useAppState();
  const s = state.profile.settings;
  const tick = useNow();
  const [past, setPast] = useState<Awaited<ReturnType<typeof closedHistory>> | null>(null);
  useEffect(() => {
    closedHistory().then(setPast);
  }, [state.day.id, state.profile.id]);

  const weekStart = resolveWeekStart(s.weekStart);
  const today = dayOf(tick, s.resetHour);
  const [period, setPeriodState] = useState<Period>(() => periodOf(s.summaryPeriod, today, weekStart));
  const setPeriod = (p: Period) => {
    setPeriodState(p);
    if (p.kind !== s.summaryPeriod) setSetting('summaryPeriod', p.kind);
  };
  // A changed week start recomputes a week period around the same day.
  useEffect(() => {
    if (period.kind === 'week') setPeriodState(periodOf('week', period.from + 3, weekStart));
  }, [weekStart]);

  const running = state.segments.some((x) => x.end === null);
  const now = running ? tick : Date.now();
  // While an activity runs everything is recomputed every second; otherwise only when the data changes.
  const byDay = useMemo(
    () => splitDays([...(past?.segments ?? []), ...state.segments], s.resetHour, now),
    [past, state.segments, s.resetHour, running ? tick : 0, state.segments.length],
  );
  const dayRecords = useMemo(() => new Map((past?.days ?? []).map((d) => [d.id, d])), [past]);

  const dim = dimensionById(s.summaryGroupBy) ?? null;
  const g = grouping(dim);
  const stats = periodStats(period, byDay, s.resetHour);
  const prev = periodStats(stepPeriod(period, -1), byDay, s.resetHour);
  const isDay = period.kind === 'day';
  const empty = stats.total === 0;

  return (
    <div class="summary-page">
      <AppHeader nav={nav} page="summary" title={t('summary.title')} onBack={onBack} />
      <div class="summary">
        {past === null ? <p class="muted">{t('summary.loading')}</p> : <>
          <PeriodCard
            period={period} setPeriod={setPeriod} today={today} weekStart={weekStart} byDay={byDay}
          />
          <Tiles period={period} stats={stats} prev={prev} today={today} running={running && period.to >= today && period.from <= today} />
          {empty ? (
            <section class="card empty-card">
              <Icon name="calendar" />
              <h2>{isDay ? t('summary.emptyDay', { date: fmtDayShort(dayDate(period.from).getTime()) }) : t('summary.emptyRange', { from: fmtMD(period.from), to: fmtMD(period.to) })}</h2>
              <p class="muted">{t('summary.emptyHint')}</p>
              <div class="row-buttons">
                <button class="primary" onClick={() => setPeriod(quickRange('Last 7 days', today, weekStart))}>{quickLabel('Last 7 days')}</button>
                <button class="secondary" onClick={onBack}>{t('footer.mainScreen')}</button>
              </div>
            </section>
          ) : <>
            {isDay && <DayTimelineCard day={stats.days[0]} g={g} nameOf={nameIn(dayRecords)} />}
            {!isDay && (
              <PerDay
                period={period} stats={stats} g={g} nameOf={nameIn(dayRecords)} resetHour={s.resetHour} weekStart={weekStart}
                onOpenDay={(n) => setPeriod(periodOf('day', n, weekStart))}
              />
            )}
            <Share period={period} stats={stats} g={g} nameOf={nameIn(dayRecords)} />
            {isDay && (
              <Sessions
                day={stats.days[0]} stats={stats} g={g} nameOf={nameIn(dayRecords)}
                onEdit={() => {
                  const dayId = stats.days[0].pieces[0]?.dayId;
                  const record = dayId && dayId !== state.day.id ? dayRecords.get(dayId) ?? null : null;
                  openPastDay(record).then(onDayEditor);
                }}
              />
            )}
          </>}
        </>}
      </div>
      <Footer onSettings={nav.onSettings} />
    </div>
  );
}

/** An activity's name on a stored day: its snapshot name for a closed day, else its current name. */
const nameIn = (records: Map<string, Day>) => (activityId: string, dayId: string | null) =>
  (dayId ? records.get(dayId)?.snapshot?.activities?.[activityId]?.name : undefined) ?? activityById(activityId)?.name ?? '?';
type NameOf = ReturnType<typeof nameIn>;

const Card = ({ label, title, hint, children, class: cls = '' }: { label: string; title: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren; class?: string }) => (
  <section class={`card ${cls}`} aria-label={label}>
    <div class="card-head"><h2>{title}</h2>{hint && <span class="card-hint">{hint}</span>}</div>
    {children}
  </section>
);

// ---------- period card: switcher line, folded calendar, picker ----------

interface PeriodCardProps {
  period: Period;
  setPeriod: (p: Period) => void;
  today: DayNum;
  weekStart: number;
  byDay: Map<DayNum, Piece[]>;
}

const dayTotal = (byDay: Map<DayNum, Piece[]>, n: DayNum) => (byDay.get(n) ?? []).reduce((sum, p) => sum + p.end - p.start, 0);

/** Background and text of a calendar cell shaded by its total. */
function heatStyle(total: number, longest: number) {
  const h = heat(total, longest);
  return h ? { background: `color-mix(in srgb, var(--accent) ${Math.round(h * 100)}%, transparent)`, color: h > 0.55 ? 'var(--on-accent)' : 'var(--text)' } : {};
}

function PeriodCard({ period, setPeriod, today, weekStart, byDay }: PeriodCardProps) {
  const s = state.profile.settings;
  const [picker, setPicker] = useState<PickerState | null>(null);
  const current = periodOf(period.kind, today, weekStart);
  const dims = state.categories;
  const picking = picker && picker.a !== null && picker.z === null;

  const label = picker?.a != null ? `${fmtMD(picker.a)} – ${picker.z != null ? fmtMD(picker.z) : '…'}` : periodLabel(period, today);
  const sub = picker?.a != null ? (picker.z != null ? days(picker.z - picker.a + 1) : t('summary.pickLast')) : periodSub(period, today);

  return (
    <section class="card period-card" aria-label={t('summary.period')}>
      <div class="segmented period-kinds" role="group" aria-label={t('summary.periodKind')}>
        {PERIODS.map((kind) => (
          <button key={kind} class="seg" aria-pressed={period.kind === kind} onClick={() => {
            if (kind === period.kind) return;
            const anchor = today >= period.from && today <= period.to ? today : period.kind === 'custom' ? period.to : period.from;
            setPeriod(periodOf(kind, anchor, weekStart));
          }}>{t(`summary.kinds.${kind}`)}</button>
        ))}
      </div>
      <div class="period-line">
        <span class="period-nav">
          <button class="icon round plain" aria-label={t('summary.prevPeriod')} onClick={() => setPeriod(stepPeriod(period, -1))}><Icon name="prev" /></button>
          <button class="period-label" aria-expanded={Boolean(picker)} aria-label={t('summary.choosePeriod', { label })} onClick={() => {
            const [y, m] = ymd(period.from);
            setPicker(picker ? null : { month: dayNum(y, m, 1), a: null, z: null });
          }}>
            <span class="period-title">{label}</span>
            {sub && <span class="period-sub hide-sm">{sub}</span>}
            <span class={`chev${picker ? ' open' : ''}`}><Icon name="chevronDown" /></span>
          </button>
          <button class="icon round plain" aria-label={t('summary.nextPeriod')} onClick={() => setPeriod(stepPeriod(period, 1))}><Icon name="next" /></button>
          {!samePeriod(period, current) && <button class="pill" onClick={() => setPeriod(current)}>{quickLabel(JUMP[period.kind])}</button>}
        </span>
        {dims.length > 0 && (
          <div class="group-by" role="group" aria-label={t('summary.groupBy')}>
            <span class="muted small hide-sm">{t('summary.groupBy')}</span>
            <span class="segmented scroll">
              {[{ id: 'activity', name: t('summary.activity') }, ...dims].map((d) => (
                <button key={d.id} class="seg" aria-pressed={(dimensionById(s.summaryGroupBy) ? s.summaryGroupBy : 'activity') === d.id} onClick={() => setSetting('summaryGroupBy', d.id)}>{d.name}</button>
              ))}
            </span>
          </div>
        )}
      </div>
      {picker
        ? <Picker picker={picker} setPicker={setPicker} today={today} weekStart={weekStart} byDay={byDay} picking={Boolean(picking)}
            onApply={(p) => {
              setPeriod(p);
              setPicker(null);
            }} />
        : <Folded period={period} weekStart={weekStart} byDay={byDay} onPick={(n) => setPeriod(periodOf('day', n, weekStart))} />}
    </section>
  );
}

/** Day number 3 (1970-01-04) is a Sunday, so 3 + w is weekday w. */
const weekdayName = (w: number, style: 'short' | 'long') => dayDate(3 + w).toLocaleDateString(intlLocale(), { weekday: style });
const weekdayHeads = (weekStart: number) => Array.from({ length: 7 }, (_, i) => weekdayName((weekStart + i) % 7, 'short').slice(0, 2));

/** Day and Week: the week strip; Custom up to 14 days: one cell per day; Month and longer (up to 62 days): a month grid. */
function Folded({ period, weekStart, byDay, onPick }: { period: Period; weekStart: number; byDay: Map<DayNum, Piece[]>; onPick: (n: DayNum) => void }) {
  const len = periodLength(period);
  const strip = period.kind === 'day' || period.kind === 'week' || (period.kind === 'custom' && len <= 14);
  if (strip) {
    const from = period.kind === 'custom' ? period.from : periodOf('week', period.from, weekStart).from;
    const to = period.kind === 'custom' ? period.to : from + 6;
    const list = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const longest = Math.max(...list.map((n) => dayTotal(byDay, n)));
    return (
      <div class="strip" style={{ gridTemplateColumns: `repeat(${Math.min(list.length, 7)}, minmax(0, 1fr))` }}>
        {list.map((n) => {
          const v = dayTotal(byDay, n);
          return (
            <button key={n} class={`strip-cell${period.kind === 'day' && n === period.from ? ' on' : ''}`} style={heatStyle(v, longest)}
              aria-label={`${fmtDayShort(dayDate(n).getTime())}, ${v ? fmtHours(v) : t('summary.nothing')}`} onClick={() => onPick(n)}>
              <span class="strip-top">{fmtDowDate(n)}</span>
              <span class="num strip-bottom">{v ? fmtHoursShort(v) : '—'}</span>
            </button>
          );
        })}
      </div>
    );
  }
  if (len > 62) return null;
  const start = periodOf('week', period.from, weekStart).from;
  const cells = Array.from({ length: Math.ceil((period.to - start + 1) / 7) * 7 }, (_, i) => start + i);
  const longest = Math.max(...cells.map((n) => dayTotal(byDay, n)));
  return (
    <div class="month-grid">
      <div class="month-heads">{weekdayHeads(weekStart).map((h, i) => <span key={i}>{h}</span>)}</div>
      <div class="month-cells">
        {cells.map((n) => {
          const inside = n >= period.from && n <= period.to;
          const v = dayTotal(byDay, n);
          return inside
            ? <button key={n} class="num month-cell" style={heatStyle(v, longest)} aria-label={`${fmtDayShort(dayDate(n).getTime())}, ${v ? fmtHours(v) : t('summary.nothing')}`} onClick={() => onPick(n)}>{ymd(n)[2]}</button>
            : <span key={n} />;
        })}
      </div>
    </div>
  );
}

/** The picker's month on show, the range being picked (start, then end), and the quick range it came from. */
interface PickerState {
  month: DayNum;
  a: DayNum | null;
  z: DayNum | null;
  quick?: QuickRange;
}

function Picker({ picker, setPicker, today, weekStart, byDay, picking, onApply }: {
  picker: PickerState; setPicker: (p: PickerState | null) => void; today: DayNum; weekStart: number; byDay: Map<DayNum, Piece[]>;
  picking: boolean; onApply: (p: Period) => void;
}) {
  const { month, a, z } = picker;
  const [y, m] = ymd(month);
  const last = dayNum(y, m + 1, 1) - 1;
  const start = periodOf('week', month, weekStart).from;
  const cells = Array.from({ length: Math.ceil((last - start + 1) / 7) * 7 }, (_, i) => start + i);
  const longest = Math.max(...cells.map((n) => dayTotal(byDay, n)));
  const toMonth = (dir: number) => setPicker({ ...picker, month: dayNum(y, m + dir, 1) });
  const wsName = weekdayName(weekStart, 'long');
  return (
    <div class="picker">
      <div class="picker-cal">
        <div class="picker-month">
          <button class="icon round plain" aria-label={t('summary.prevMonth')} onClick={() => toMonth(-1)}><Icon name="prev" /></button>
          <strong>{fmtMonth(month)}</strong>
          <button class="icon round plain" aria-label={t('summary.nextMonth')} onClick={() => toMonth(1)}><Icon name="next" /></button>
        </div>
        <div class="month-heads">{weekdayHeads(weekStart).map((h, i) => <span key={i}>{h}</span>)}</div>
        <div class="picker-cells">
          {cells.map((n) => {
            if (n < month || n > last) return <span key={n} />;
            const v = dayTotal(byDay, n);
            const edge = n === a || n === z;
            const inside = a !== null && (z === null ? n === a : n >= a && n <= z);
            return (
              <button
                key={n} class={`num pick-cell${inside ? ' in' : ''}${edge ? ' edge' : ''}${n === today ? ' today' : ''}`} style={heatStyle(v, longest)}
                aria-pressed={edge} aria-label={`${fmtDayShort(dayDate(n).getTime())}, ${v ? fmtHours(v) : t('summary.nothing')}`}
                onClick={() => setPicker(picking && n >= a! ? { ...picker, z: n, quick: undefined } : { ...picker, a: n, z: null, quick: undefined })}
              >{ymd(n)[2]}</button>
            );
          })}
        </div>
      </div>
      <div class="picker-side">
        <span class="muted small">{t('summary.quickRanges')}</span>
        <div class="pills">
          {QUICK_RANGES.map((q) => (
            <button key={q} class="pill" aria-pressed={picker.quick === q} onClick={() => {
              const p = quickRange(q, today, weekStart);
              const [py, pm] = ymd(p.from);
              setPicker({ month: dayNum(py, pm, 1), a: p.from, z: p.to, quick: q });
            }}>{quickLabel(q)}</button>
          ))}
        </div>
        <span class="muted">{t(picking ? 'summary.pickLastHint' : 'summary.pickFirstHint')}</span>
        <span class="muted small">{t('summary.shadedHint', { day: wsName })}</span>
        <div class="row-buttons">
          <button class="secondary" onClick={() => setPicker(null)}>{t('common.cancel')}</button>
          <button class="primary" disabled={a === null} onClick={() => {
            if (picker.quick) onApply(quickRange(picker.quick, today, weekStart));
            else if (a !== null) onApply(rangePeriod(a, z ?? a, weekStart));
          }}>{t('common.apply')}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- figure tiles ----------

function Tiles({ period, stats, prev, today, running }: { period: Period; stats: PeriodStats; prev: PeriodStats; today: DayNum; running: boolean }) {
  const tiles: { label: string; value: string; sub: string }[] = [];
  if (period.kind === 'day') {
    const d = stats.days[0];
    const sessions = d.pieces.length;
    const live = d.pieces.some((p) => p.live);
    tiles.push(
      { label: t('summary.total'), value: fmtHours(d.total), sub: running ? t('summary.live') : fmtDayShort(dayDate(period.from).getTime()) },
      { label: t('summary.firstLast'), value: d.first === null ? '—' : `${fmtClock(d.first)} – ${live ? t('time.now') : fmtClock(d.last!)}`, sub: d.first === null ? '' : t('summary.firstLastHint') },
      { label: t('header.idle'), value: d.first === null ? '—' : fmtHours(d.idle), sub: t('summary.idleHint') },
      { label: t('summary.switches'), value: sessions ? String(sessions - 1) : '—', sub: tn('summary.sessions', sessions) },
    );
  } else {
    const diff = stats.total - prev.total;
    tiles.push(
      { label: t('summary.total'), value: fmtHours(stats.total), sub: periodLabel(period, today) },
      { label: t('summary.avg'), value: stats.tracked ? fmtHours(stats.total / stats.tracked) : '—', sub: stats.tracked ? tn('summary.trackedDays', stats.tracked) : t('summary.noTrackedDays') },
      {
        label: versus(period).label,
        value: prev.total && stats.total ? `${diff >= 0 ? '+' : '−'}${fmtHours(Math.abs(diff))}` : '—',
        sub: prev.total ? t('summary.previous', { time: fmtHours(prev.total) }) : versus(period).none,
      },
    );
  }
  return (
    <div class="tiles-grid">
      {tiles.map((tile) => (
        <div key={tile.label} class="fig">
          <span class="fig-label">{tile.label}</span>
          <span class="num fig-value">{tile.value}</span>
          <span class="fig-sub">{tile.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Day: timeline ----------

/** A day's pieces with the idle gaps between them, in time order. */
function withIdle(pieces: Piece[]) {
  const out: ({ idle: false; p: Piece; start: number; end: number } | { idle: true; start: number; end: number })[] = [];
  let at: number | null = null;
  for (const p of pieces) {
    if (at !== null && p.start > at) out.push({ idle: true, start: at, end: p.start });
    out.push({ idle: false, p, start: p.start, end: p.end });
    at = Math.max(at ?? p.end, p.end);
  }
  return out;
}

function DayTimelineCard({ day, g, nameOf }: { day: DayStats; g: Grouping; nameOf: NameOf }) {
  const [sel, setSel] = useState<number | null>(null);
  const blocks = withIdle(day.pieces);
  const from = day.first!;
  const to = day.last!;
  const span = Math.max(to - from, MIN);
  const live = day.pieces.some((p) => p.live);
  const ticks: { t: number; left: number }[] = [];
  for (let t = Math.ceil(from / 3600000) * 3600000; t < to; t += 3600000) {
    const left = (t - from) / span;
    // Clear of the start and end labels at the edges.
    if (left > 0.08 && left < 0.92) ticks.push({ t, left });
  }
  const picked = sel !== null ? blocks[sel] : undefined;
  const pickedName = picked && (picked.idle ? t('header.idle') : nameOf(picked.p.activityId, picked.p.dayId));
  return (
    <Card label={t('summary.timeline')} title={t('summary.timeline')} hint={picked
      ? <span class="strong">{pickedName} · {fmtClock(picked.start)} – {!picked.idle && picked.p.live ? t('time.now') : fmtClock(picked.end)} · {fmtHM(picked.end - picked.start)}</span>
      : t('summary.tapBlock')}>
      <div class="ticks num">
        <span style={{ left: 0, transform: 'none' }}>{fmtClock(from)}</span>
        {ticks.map(({ t, left }) => <span key={t} class={new Date(t).getHours() % 2 ? 'hide-sm' : ''} style={{ left: `${left * 100}%` }}>{fmtClock(t)}</span>)}
        <span style={{ left: '100%', transform: 'translateX(-100%)' }}>{live ? t('time.now') : fmtClock(to)}</span>
      </div>
      <div class="blocks big">
        {blocks.map((b, i) => {
          const ms = b.end - b.start;
          const name = b.idle ? t('header.idle') : nameOf(b.p.activityId, b.p.dayId);
          const end = !b.idle && b.p.live ? t('time.now') : fmtClock(b.end);
          return (
            <button
              key={i} class={`block${b.idle ? ' idle' : ''}`} aria-pressed={sel === i}
              aria-label={t('summary.blockLabel', { name, from: fmtClock(b.start), to: end })} data-tip={`${name} · ${fmtClock(b.start)} – ${end} · ${fmtHM(ms)}`}
              style={{ flexGrow: ms, background: b.idle ? undefined : g.color(g.keyOf(b.p.activityId)) }}
              onClick={() => setSel(sel === i ? null : i)}
            >
              {!b.idle && b.p.live && <span class="pulse" />}
              {ms >= 40 * MIN ? <span>{fmtHM(ms)}</span> : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Week / Month / Custom: per day ----------

function PerDay({ period, stats, g, nameOf, resetHour, weekStart, onOpenDay }: {
  period: Period; stats: PeriodStats; g: Grouping; nameOf: NameOf; resetHour: number; weekStart: number; onOpenDay: (n: DayNum) => void;
}) {
  const [sel, setSel] = useState<DayNum | null>(null);
  const compact = period.kind === 'month';

  if (periodLength(period) > WEEK_ROWS_AFTER) {
    const rows = weekRows(stats.days, weekStart);
    const max = Math.max(1, ...rows.map((r) => r.total));
    return (
      <Card label={t('summary.perWeek')} title={t('summary.perWeek')} hint={t('summary.perWeekHint')}>
        {rows.map((r) => (
          <div key={r.from} class="day-row">
            <span class="day-name"><strong>{fmtMD(r.from)}</strong><span class="muted">– {fmtMD(r.to)}</span></span>
            <span class="day-bar stacked">
              {totalsBy(r.byActivity, g.keyOf).map(([k, v]) => (
                <span key={k} style={{ width: `${(v.total / max) * 100}%`, background: g.color(k) }} title={`${g.name(k)} ${fmtHours(v.total)}`} />
              ))}
            </span>
            <span class={`num day-total${r.total ? '' : ' muted'}`}>{r.total ? fmtHours(r.total) : '—'}</span>
          </div>
        ))}
      </Card>
    );
  }

  const axis = axisRange(stats.days, resetHour);
  const [lo, hi] = axis;
  const pos = (ms: number) => `${((ms - lo) / (hi - lo)) * 100}%`;
  const base0 = dayStart(period.from, resetHour);
  const ticks = axisTicks(axis);
  // A dotted line down from each axis label through every day's bar.
  const guides = ticks.map((t) => <span key={t} class="guide" style={{ left: pos(t) }} />);
  const showAvg = stats.tracked > 1;
  const hint = showAvg
    ? t('summary.avgHint', { start: fmtClock(base0 + stats.avgStart!), end: fmtClock(base0 + stats.avgEnd!) })
    : t('summary.tapDay');
  return (
    <Card label={t('summary.perDay')} title={t('summary.perDay')} hint={hint} class={compact ? 'compact' : ''}>
      <div class="day-row axis">
        <span />
        <span class="num axis-labels">
          {ticks.map((t) => <span key={t} style={{ left: pos(t) }}>{fmtClock(base0 + t)}</span>)}
          {guides}
        </span>
        <span />
      </div>
      {dayRows(stats.days).map((r) => {
        if (r.kind === 'gap') {
          return (
            <div key={`gap-${r.from}`} class="day-row gap-row">
              <span />
              <span class="gap-text">{fmtDowDate(r.from)} – {fmtDowDate(r.to)} · {t('summary.nothing')}</span>
              <span />
            </div>
          );
        }
        const d = r.stats;
        const base = dayStart(d.day, resetHour);
        const open = sel === d.day;
        return (
          <div key={d.day}>
            <button class={`day-row${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setSel(open ? null : d.day)}>
              <span class="day-name"><strong>{fmtDow(d.day)}</strong><span class="muted">{fmtMD(d.day)}</span></span>
              <span class="day-bar">
                {guides}
                {d.pieces.map((p) => {
                  const ms = p.end - p.start;
                  const key = g.keyOf(p.activityId);
                  const tip = `${nameOf(p.activityId, p.dayId)}${g.dim ? ` (${g.name(key)})` : ''} · ${fmtClock(p.start)} – ${p.live ? t('time.now') : fmtClock(p.end)} · ${fmtHM(ms)}`;
                  return (
                    <span key={`${p.segId}-${p.start}`} class="day-block" data-tip={tip} style={{ left: pos(p.start - base), width: pos(lo + ms), background: g.color(key) }}>
                      {!compact && ms >= 70 * MIN ? <span>{fmtHM(ms)}</span> : null}
                    </span>
                  );
                })}
                {showAvg && <><span class="avg-line" style={{ left: pos(stats.avgStart!) }} /><span class="avg-line" style={{ left: pos(stats.avgEnd!) }} /></>}
              </span>
              <span class={`num day-total${d.total ? '' : ' muted'}`}>{d.total ? fmtHours(d.total) : '—'}</span>
            </button>
            {open && (
              <div class="day-detail">
                <strong>{fmtDayShort(dayDate(d.day).getTime())} · {fmtHours(d.total)}</strong>
                {totalsBy(d.byActivity, g.keyOf).map(([k, v]) => (
                  <span key={k} class={`part${g.dim ? '' : ' cap'}`}><span class="sq" style={{ background: g.color(k) }} />{g.name(k)} <span class="num muted">{fmtHours(v.total)}</span></span>
                ))}
                <button class="pill strong" onClick={() => onOpenDay(d.day)}>{t('summary.openDay')} ›</button>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// ---------- share: donut + table ----------

const R = 60;
const CIRC = 2 * Math.PI * R;

function Share({ period, stats, g, nameOf }: { period: Period; stats: PeriodStats; g: Grouping; nameOf: NameOf }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isDay = period.kind === 'day';
  const groups = totalsBy(stats.byActivity, g.keyOf);
  const total = stats.total;
  const pct = (ms: number) => `${Math.round((ms / total) * 100)}%`;
  const dayId = isDay ? stats.days[0].pieces[0]?.dayId ?? null : null;
  const avg = (ms: number) => (stats.tracked ? fmtHours(ms / stats.tracked) : '—');
  let acc = 0;

  const actRow = (id: string, ms: number, nested: boolean) => {
    const a = activityById(id);
    const target = a?.targetMin ? a.targetMin * MIN : 0;
    const over = target && ms > target;
    return (
      <div key={id} class={`share-row${nested ? ' nested' : ''}`}>
        <span class="share-name">
          <span class="share-line">
            <span class="sq" style={{ background: slotColor(a?.colorSlot ?? 0) }} />
            <span class="ellipsis" title={nameOf(id, dayId)}>{nameOf(id, dayId)}</span>
            {isRemoved(a) && <span class="muted small">{t('editor.removed')}</span>}
          </span>
          {!nested && !isDay && target > 0 && (
            <span class="share-sub">{tn('summary.targetMet', stats.tracked, { target: fmtHours(target), met: targetMetDays(stats.days, id, target) })}</span>
          )}
        </span>
        <span class="num">{fmtHours(ms)}</span>
        <span class="num muted">{pct(ms)}</span>
        <span class="c4 hide-sm">
          {isDay ? <>
            <span class={`num${over ? ' danger-text' : ' muted'}`}>{target ? targetText(a!.targetMin, ms) : '—'}</span>
            {target > 0 && !nested && <span class="thin"><span style={{ width: `${Math.min(100, (ms / target) * 100)}%`, background: slotColor(a!.colorSlot) }} /></span>}
          </> : <span class="num muted">{avg(ms)}</span>}
        </span>
      </div>
    );
  };

  return (
    <Card
      label={t('summary.share')} title={<>{t('summary.share')} <span class="muted">· {g.dim?.name ?? t('summary.activity')}</span></>}
      hint={g.dim ? t('summary.tapOption') : isDay ? '' : t('summary.avgOver')}
    >
      <div class="share">
        <svg class="donut" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={t('summary.shareOfTime')}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--track)" stroke-width="22" />
          {groups.map(([k, v]) => {
            const len = (v.total / total) * CIRC;
            const el = (
              <circle key={k} cx="80" cy="80" r={R} fill="none" stroke={g.color(k)} stroke-width="22" transform="rotate(-90 80 80)"
                stroke-dasharray={`${Math.max(len - 1.5, 0)} ${CIRC}`} stroke-dashoffset={-acc} />
            );
            acc += len;
            return el;
          })}
          <text x="80" y="80" text-anchor="middle" class="donut-total">{t('summary.donutHours', { h: Math.round(total / 3600000) })}</text>
          <text x="80" y="97" text-anchor="middle" class="donut-sub">{t('main.tracked')}</text>
        </svg>
        <div class="share-table">
          <div class="share-row head"><span>{t('summary.name')}</span><span>{t('summary.totalCol')}</span><span>{t('summary.share')}</span><span class="hide-sm">{t(isDay ? 'summary.target' : 'summary.avgDay')}</span></div>
          {g.dim
            ? groups.map(([k, v]) => {
              const on = Boolean(open[k]);
              const acts = [...v.activities].sort((x, y) => stats.byActivity.get(y)! - stats.byActivity.get(x)!);
              return (
                <div key={k}>
                  <button class="share-row option" aria-expanded={on} onClick={() => setOpen({ ...open, [k]: !on })}>
                    <span class="share-line">
                      <span class={`chev-r${on ? ' open' : ''}`}><Icon name="chevronRight" /></span>
                      <span class="sq" style={{ background: g.color(k) }} />
                      <strong class="ellipsis">{g.name(k)}</strong>
                      <span class="muted small nowrap">{tn('settings.activityCount', acts.length)}</span>
                    </span>
                    <span class="num strong">{fmtHours(v.total)}</span>
                    <span class="num muted">{pct(v.total)}</span>
                    <span class="num muted c4 hide-sm">{isDay ? '' : avg(v.total)}</span>
                  </button>
                  {on && acts.map((id) => actRow(id, stats.byActivity.get(id)!, true))}
                </div>
              );
            })
            : groups.map(([k, v]) => actRow(k, v.total, false))}
        </div>
      </div>
    </Card>
  );
}

// ---------- Day: sessions ----------

function Sessions({ day, stats, g, nameOf, onEdit }: { day: DayStats; stats: PeriodStats; g: Grouping; nameOf: NameOf; onEdit: () => void }) {
  const s = state.profile.settings;
  const grouped = Boolean(g.dim) && s.summaryGroupLog;
  const rows = withIdle(day.pieces);
  const row = (b: (typeof rows)[number], i: number) => (
    <div key={i} class={`log-row${b.idle ? ' idle' : ''}`}>
      <span class="sq" style={b.idle ? undefined : { background: slotColor(activityById(b.p.activityId)?.colorSlot ?? 0) }} />
      <span class="ellipsis">{b.idle ? t('header.idle') : nameOf(b.p.activityId, b.p.dayId)}</span>
      <span class="num muted">{fmtClock(b.start)} – {!b.idle && b.p.live ? t('time.now') : fmtClock(b.end)}</span>
      <span class="num">{!b.idle && b.p.live ? '● ' : ''}{fmtHM(b.end - b.start)}</span>
    </div>
  );
  let body: ComponentChildren;
  if (grouped) {
    const idle = rows.filter((b) => b.idle);
    const head = (key: string, name: string, color: string | undefined, ms: number) => (
      <div key={`h-${key}`} class="log-head"><span class="sq" style={{ background: color }} />{name}<span class="num muted">{fmtHM(ms)}</span></div>
    );
    body = [
      ...totalsBy(stats.byActivity, g.keyOf).flatMap(([k, v]) => [
        head(k, g.name(k), g.color(k), v.total),
        ...rows.map((b, i) => (!b.idle && g.keyOf(b.p.activityId) === k ? row(b, i) : null)),
      ]),
      ...(idle.length ? [head('idle', t('header.idle'), 'var(--track)', idle.reduce((sum, b) => sum + b.end - b.start, 0)), ...rows.map((b, i) => (b.idle ? row(b, i) : null))] : []),
    ];
  } else body = rows.map(row);
  return (
    <section class="card" aria-label={t('summary.sessionsTitle')}>
      <div class="card-head sessions-head">
        <h2>{t('summary.sessionsTitle')} <span class="muted">· {tn('summary.sessions', day.pieces.length)}</span></h2>
        {g.dim && (
          <label class="check">
            <input type="checkbox" checked={s.summaryGroupLog} onChange={(e) => setSetting('summaryGroupLog', e.currentTarget.checked)} />
            {t('summary.groupLog', { name: g.dim.name })}
          </label>
        )}
        <button class="secondary push" onClick={onEdit}>{t('popup.editSessions')}</button>
      </div>
      {body}
    </section>
  );
}
