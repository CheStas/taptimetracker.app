// Touch-friendly time picker: a big HH:MM field you can type into, +/- steps and "x min ago" shortcuts.
import { fmtClock } from './util.ts';
import { t } from '../i18n.ts';

const STEPS = [-15, -5, -1, 1, 5, 15];
const AGO = [0, 5, 10, 15, 30, 60];

/** Clamp a timestamp to [min, max]; max defaults to now. */
export const clampTime = (t: number, min: number, max = Date.now()) => Math.min(Math.max(t, min), max);

/** "9:05", "905", "0905", "21.30", "21" -> [hours, minutes], or null. */
export function parseClock(text: string): [number, number] | null {
  const m = text.trim().match(/^(\d{1,2})(?:[:.\s]?(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? [h, min] : null;
}

/** That clock time on the date nearest to `near` (the day before, the same day or the day after) within [min, max]. */
export function atClock([h, m]: [number, number], near: number, min: number, max = Date.now()) {
  const candidates = [-1, 0, 1].map((dd) => {
    const d = new Date(near);
    d.setDate(d.getDate() + dd);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  });
  const inRange = candidates.filter((c) => c >= min && c <= max);
  const pool = inRange.length ? inRange : candidates;
  return clampTime(pool.reduce((a, b) => (Math.abs(b - near) < Math.abs(a - near) ? b : a)), min, max);
}

interface Props {
  value: number;
  onChange: (t: number) => void;
  /** earliest allowed timestamp */
  min: number;
  /** latest allowed timestamp (default: now); a closed day's end, so the "x min ago" shortcuts are hidden */
  max?: number;
  label?: string;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, min, max, label, disabled }: Props) {
  const set = (t: number) => onChange(clampTime(t, min, max));
  // ±1 steps are hidden on a phone.
  const step = (s: number) => (
    <button type="button" key={s} class={Math.abs(s) === 1 ? 'hide-sm' : ''} onClick={() => set(value + s * 60000)}>{s > 0 ? `+${s}` : `−${-s}`}</button>
  );
  const now = Date.now();
  return (
    <div class={`tp${disabled ? ' disabled' : ''}`}>
      {label && <div class="tp-label">{label}</div>}
      <div class="tp-row">
        {STEPS.filter((s) => s < 0).map(step)}
        <input
          type="text" inputMode="numeric" autoComplete="off" maxLength={5} class="tp-value" value={fmtClock(value)}
          aria-label={label ?? t('time.time')} disabled={disabled}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.stopPropagation();
              e.currentTarget.value = fmtClock(value);
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const el = e.currentTarget;
            const hm = parseClock(el.value);
            if (hm) onChange(atClock(hm, value, min, max));
            el.value = fmtClock(hm ? atClock(hm, value, min, max) : value);
          }}
        />
        {STEPS.filter((s) => s > 0).map(step)}
      </div>
      {max === undefined && (
        <div class="tp-ago">
          {AGO.map((m) => (
            <button type="button" key={m} class="pill" aria-pressed={fmtClock(value) === fmtClock(clampTime(now - m * 60000, min))} onClick={() => set(Date.now() - m * 60000)}>
              {m ? t('time.ago', { m }) : t('time.now')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
