import { describe, expect, it } from 'vitest';
import { atClock, parseClock } from '../src/ui/timePicker.tsx';

const at = (d: string) => new Date(d).getTime();

describe('parseClock', () => {
  it('reads the usual ways to type a time', () => {
    expect(parseClock('9:05')).toEqual([9, 5]);
    expect(parseClock('905')).toEqual([9, 5]);
    expect(parseClock('0905')).toEqual([9, 5]);
    expect(parseClock('21.30')).toEqual([21, 30]);
    expect(parseClock(' 21 ')).toEqual([21, 0]);
  });

  it('rejects anything else', () => {
    for (const s of ['', '24:00', '9:60', 'abc', '12345', '9:5']) expect(parseClock(s), s).toBeNull();
  });
});

describe('atClock', () => {
  it('takes the time on the same day', () => {
    expect(atClock([8, 15], at('2026-11-27T10:00'), at('2026-11-27T00:00'), at('2026-11-27T12:00'))).toBe(at('2026-11-27T08:15'));
  });

  it('goes back across midnight when the day started the evening before', () => {
    expect(atClock([23, 30], at('2026-11-27T01:00'), at('2026-11-26T22:00'), at('2026-11-27T02:00'))).toBe(at('2026-11-26T23:30'));
  });

  it('clamps to the day', () => {
    expect(atClock([7, 0], at('2026-11-27T10:00'), at('2026-11-27T09:00'), at('2026-11-27T12:00'))).toBe(at('2026-11-27T09:00'));
    expect(atClock([13, 0], at('2026-11-27T10:00'), at('2026-11-27T09:00'), at('2026-11-27T12:00'))).toBe(at('2026-11-27T12:00'));
  });
});
