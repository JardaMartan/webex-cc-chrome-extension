import {
  monthMatrix,
  addMonths,
  isSameDay,
  isSelectableDay,
  toDateValue,
  startOfDay,
  WEEK_LENGTH,
} from '../src/widget/callback/calendarGrid.js';

const NOW = new Date('2026-09-03T10:00:00');

describe('monthMatrix', () => {
  it('returns Monday-first weeks of exactly seven days', () => {
    const weeks = monthMatrix(2026, 8); // September 2026
    weeks.forEach((week) => expect(week).toHaveLength(WEEK_LENGTH));
    // 1 Sep 2026 is a Tuesday, so the first cell is Monday 31 Aug.
    expect(toDateValue(weeks[0][0].date)).toBe('2026-08-31');
    expect(weeks[0][0].inMonth).toBe(false);
    expect(toDateValue(weeks[0][1].date)).toBe('2026-09-01');
    expect(weeks[0][1].inMonth).toBe(true);
  });

  it('covers every day of the month', () => {
    const days = monthMatrix(2026, 8)
      .flat()
      .filter((d) => d.inMonth);
    expect(days).toHaveLength(30);
  });

  it('handles a month starting on a Monday without a leading pad week', () => {
    // 1 Jun 2026 is a Monday.
    const weeks = monthMatrix(2026, 5);
    expect(toDateValue(weeks[0][0].date)).toBe('2026-06-01');
    expect(weeks[0][0].inMonth).toBe(true);
  });

  it('handles February in a leap year', () => {
    const days = monthMatrix(2024, 1)
      .flat()
      .filter((d) => d.inMonth);
    expect(days).toHaveLength(29);
  });
});

describe('addMonths', () => {
  it('does not overflow from a 31-day month into the month after next', () => {
    expect(toDateValue(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });

  it('crosses year boundaries in both directions', () => {
    expect(toDateValue(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-01');
    expect(toDateValue(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-01');
  });
});

describe('isSelectableDay', () => {
  it('refuses days in the past', () => {
    expect(isSelectableDay(new Date('2026-09-02T23:00:00'), { now: NOW })).toBe(false);
  });

  it('allows today even though the clock has already moved on', () => {
    expect(isSelectableDay(new Date('2026-09-03T00:00:00'), { now: NOW })).toBe(true);
  });

  it('allows the last day of the API window but not the day after', () => {
    expect(isSelectableDay(new Date('2026-10-04T12:00:00'), { now: NOW, maxDaysAhead: 31 })).toBe(true);
    expect(isSelectableDay(new Date('2026-10-05T12:00:00'), { now: NOW, maxDaysAhead: 31 })).toBe(false);
  });
});

describe('day helpers', () => {
  it('compares calendar days, ignoring the time of day', () => {
    expect(isSameDay(new Date('2026-09-03T01:00:00'), new Date('2026-09-03T23:00:00'))).toBe(true);
    expect(isSameDay(new Date('2026-09-03T23:00:00'), new Date('2026-09-04T00:00:00'))).toBe(false);
  });

  it('normalises to midnight without mutating its argument', () => {
    const original = new Date('2026-09-03T10:00:00');
    expect(startOfDay(original).getHours()).toBe(0);
    expect(original.getHours()).toBe(10);
  });
});
