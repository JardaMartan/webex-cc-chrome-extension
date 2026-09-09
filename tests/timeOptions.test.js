import {
  timeOptions,
  earliestMoment,
  generateTimeSlots,
  findCallbackConflict,
  timeToMinutes,
  minutesToTime,
  MINUTE_INTERVAL,
  MINUTE_STEP,
} from '../src/widget/callback/timeOptions.js';

const NOW = new Date('2026-09-03T10:07:00');
const TODAY = '2026-09-03';
const TOMORROW = '2026-09-04';
const YESTERDAY = '2026-09-02';

describe('time conversions', () => {
  it('converts HH:mm and HH:mm:ss to minutes from midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('08:15')).toBe(495);
    expect(timeToMinutes('17:45:00')).toBe(1065);
    expect(timeToMinutes('')).toBeNull();
    expect(timeToMinutes(null)).toBeNull();
  });

  it('formats minutes from midnight to 24-hour HH:mm', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(495)).toBe('08:15');
    expect(minutesToTime(1065)).toBe('17:45');
    expect(minutesToTime(null)).toBe('');
  });
});

describe('earliestMoment', () => {
  it('is the API lead time ahead of now', () => {
    expect(earliestMoment(NOW).toISOString()).toBe(new Date('2026-09-03T10:37:00').toISOString());
  });
});

describe('generateTimeSlots', () => {
  it('generates 15-minute interval slots in 24-hour format within working hours', () => {
    const slots = generateTimeSlots({ start: '08:00', end: '17:00', interval: 15 });
    expect(slots[0]).toBe('08:00');
    expect(slots[1]).toBe('08:15');
    expect(slots[2]).toBe('08:30');
    expect(slots[3]).toBe('08:45');
    expect(slots[4]).toBe('09:00');
    expect(slots[slots.length - 1]).toBe('17:00');
    // From 08:00 to 17:00 at 15-min intervals: 9 hours * 4 + 1 = 37 slots
    expect(slots).toHaveLength(37);
  });

  it('generates a full 24-hour day of 15-minute slots', () => {
    const slots = generateTimeSlots({ start: '00:00', end: '23:45', interval: 15 });
    expect(slots[0]).toBe('00:00');
    expect(slots[slots.length - 1]).toBe('23:45');
    expect(slots).toHaveLength(96); // 24 * 4
  });
});

describe('timeOptions', () => {
  it('hides time slots before 30-min lead time on the earliest day', () => {
    // NOW is 10:07, so earliest selectable moment is 10:37.
    // Working hours 08:00-17:00: 08:00..10:30 are past/too soon, first available is 10:45.
    const { slots } = timeOptions(TODAY, NOW, { start: '08:00', end: '17:00', interval: 15 });
    expect(slots[0]).toBe('10:45');
    expect(slots).not.toContain('10:30');
    expect(slots).not.toContain('08:00');
    expect(slots).toContain('17:00');
  });

  it('offers all working hours slots for a future date', () => {
    const { slots } = timeOptions(TOMORROW, NOW, { start: '08:00', end: '17:00', interval: 15 });
    expect(slots[0]).toBe('08:00');
    expect(slots[1]).toBe('08:15');
    expect(slots[slots.length - 1]).toBe('17:00');
    expect(slots).toHaveLength(37);
  });

  it('returns empty slots for a date in the past', () => {
    const { slots } = timeOptions(YESTERDAY, NOW, { start: '08:00', end: '17:00', interval: 15 });
    expect(slots).toHaveLength(0);
  });

  it('offers all working hours slots when no date is chosen yet', () => {
    const { slots } = timeOptions('', NOW, { start: '09:00', end: '18:00', interval: 15 });
    expect(slots[0]).toBe('09:00');
    expect(slots[slots.length - 1]).toBe('18:00');
    expect(slots).toHaveLength(37);
  });

  it(`uses 15-minute step constant ${MINUTE_INTERVAL}`, () => {
    expect(MINUTE_INTERVAL).toBe(15);
    expect(MINUTE_STEP).toBe(15);
  });
});

describe('findCallbackConflict', () => {
  const agentId = 'agent-123';
  const scheduledCallbacks = [
    {
      id: 'cb-1',
      scheduleDate: '2026-09-04',
      startTime: '10:00:00',
      endTime: '10:30:00',
      customerName: 'Alice Smith',
      callbackNumber: '+1234567890',
      assigneeAgent: agentId,
    },
    {
      id: 'cb-2',
      scheduleDate: '2026-09-04',
      startTime: '14:00:00',
      endTime: '15:00:00',
      customerName: 'Bob Jones',
      callbackNumber: '+1987654321',
      assigneeAgent: agentId,
    },
    {
      id: 'cb-other-agent',
      scheduleDate: '2026-09-04',
      startTime: '11:00:00',
      endTime: '11:30:00',
      customerName: 'Charlie',
      callbackNumber: '+1122334455',
      assigneeAgent: 'agent-other',
    },
  ];

  it('detects direct overlapping callback for the same agent', () => {
    const conflict = findCallbackConflict(
      { date: '2026-09-04', time: '10:15', windowMinutes: 30 },
      scheduledCallbacks,
      { myAgentId: agentId }
    );
    expect(conflict).toBeDefined();
    expect(conflict.id).toBe('cb-1');
  });

  it('detects conflict when candidate envelops existing callback', () => {
    const conflict = findCallbackConflict(
      { date: '2026-09-04', time: '13:30', windowMinutes: 120 },
      scheduledCallbacks,
      { myAgentId: agentId }
    );
    expect(conflict).toBeDefined();
    expect(conflict.id).toBe('cb-2');
  });

  it('returns null when times are adjacent (non-overlapping)', () => {
    const conflict1 = findCallbackConflict(
      { date: '2026-09-04', time: '09:30', windowMinutes: 30 }, // ends at 10:00
      scheduledCallbacks,
      { myAgentId: agentId }
    );
    expect(conflict1).toBeNull();

    const conflict2 = findCallbackConflict(
      { date: '2026-09-04', time: '10:30', windowMinutes: 30 }, // starts at 10:30
      scheduledCallbacks,
      { myAgentId: agentId }
    );
    expect(conflict2).toBeNull();
  });

  it('returns null for a different date', () => {
    const conflict = findCallbackConflict(
      { date: '2026-09-05', time: '10:15', windowMinutes: 30 },
      scheduledCallbacks,
      { myAgentId: agentId }
    );
    expect(conflict).toBeNull();
  });

  it('ignores callback currently being rescheduled (excludeId)', () => {
    const conflict = findCallbackConflict(
      { date: '2026-09-04', time: '10:00', windowMinutes: 30 },
      scheduledCallbacks,
      { excludeId: 'cb-1', myAgentId: agentId }
    );
    expect(conflict).toBeNull();
  });

  it('ignores callbacks assigned to other agents when myAgentId is specified', () => {
    const conflict = findCallbackConflict(
      { date: '2026-09-04', time: '11:00', windowMinutes: 30 },
      scheduledCallbacks,
      { myAgentId: agentId }
    );
    expect(conflict).toBeNull();
  });

  it('returns null when candidate is incomplete', () => {
    expect(findCallbackConflict(null, scheduledCallbacks)).toBeNull();
    expect(findCallbackConflict({ date: '2026-09-04', time: '' }, scheduledCallbacks)).toBeNull();
    expect(findCallbackConflict({ date: '', time: '10:00' }, scheduledCallbacks)).toBeNull();
  });
});
