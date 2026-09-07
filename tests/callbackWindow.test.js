import { windowMinutesBetween, MIN_WINDOW_MINUTES } from '../src/widget/callback/callbackRequest.js';

describe('windowMinutesBetween', () => {
  it('recovers the window from an existing callback', () => {
    expect(windowMinutesBetween('12:00:00', '12:30:00')).toBe(30);
    expect(windowMinutesBetween('09:15:00', '13:15:00')).toBe(240);
  });

  it('handles a window running past midnight', () => {
    expect(windowMinutesBetween('23:30:00', '01:30:00')).toBe(120);
  });

  it('falls back to the minimum for missing or unparseable times', () => {
    expect(windowMinutesBetween(undefined, '12:30:00')).toBe(MIN_WINDOW_MINUTES);
    expect(windowMinutesBetween('12:00:00', 'nonsense')).toBe(MIN_WINDOW_MINUTES);
    expect(windowMinutesBetween('12:00:00', '12:00:00')).toBe(MIN_WINDOW_MINUTES);
  });
});
