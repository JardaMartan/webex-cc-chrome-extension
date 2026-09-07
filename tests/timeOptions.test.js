import { timeOptions, earliestMoment, MINUTE_STEP } from '../src/widget/callback/timeOptions.js';

const NOW = new Date('2026-09-03T10:07:00');
const TODAY = '2026-09-03';
const TOMORROW = '2026-09-04';

describe('earliestMoment', () => {
  it('is the API lead time ahead of now', () => {
    expect(earliestMoment(NOW).toISOString()).toBe(new Date('2026-09-03T10:37:00').toISOString());
  });
});

describe('timeOptions', () => {
  it('hides hours already past on the earliest day', () => {
    const { hours } = timeOptions(TODAY, NOW);
    expect(hours[0]).toBe('10');
    expect(hours).not.toContain('09');
    expect(hours).toContain('23');
  });

  it('offers the whole day for a later date', () => {
    const { hours, minutesFor } = timeOptions(TOMORROW, NOW);
    expect(hours[0]).toBe('00');
    expect(hours).toHaveLength(24);
    expect(minutesFor('00')[0]).toBe('00');
  });

  it('trims minutes inside the boundary hour only', () => {
    const { minutesFor } = timeOptions(TODAY, NOW);
    // Lead time lands at 10:37, so 10:35 is gone but 10:40 remains.
    expect(minutesFor('10')).not.toContain('35');
    expect(minutesFor('10')).toContain('40');
    // A later hour on the same day is unrestricted.
    expect(minutesFor('11')[0]).toBe('00');
  });

  it(`steps minutes by ${MINUTE_STEP}`, () => {
    expect(timeOptions(TOMORROW, NOW).minutesFor('09')).toHaveLength(60 / MINUTE_STEP);
  });

  it('offers a full day when no date is chosen yet', () => {
    expect(timeOptions('', NOW).hours).toHaveLength(24);
  });
});
