/*
 * widget/callback/timeOptions.js — 15-minute interval time slot generator
 * and conflict checker for the Momentum-styled callback time picker.
 * DOM-free so the rules and lead time can be unit-tested.
 */
import { MIN_LEAD_MINUTES } from './callbackRequest.js';

const MINUTE = 60 * 1000;
export const MINUTE_STEP = 15;
export const MINUTE_INTERVAL = 15;

export function pad(n) {
  return String(n).padStart(2, '0');
}

/** Parses "HH:mm" or "HH:mm:ss" into minutes from midnight (0..1439). */
export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

/** Formats minutes from midnight into 24-hour "HH:mm". */
export function minutesToTime(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '';
  const total = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad(h)}:${pad(m)}`;
}

/** Earliest selectable moment: the API needs a 30-minute lead time. */
export function earliestMoment(now = new Date()) {
  return new Date(now.getTime() + MIN_LEAD_MINUTES * MINUTE);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Generates an array of "HH:mm" time strings between `start` and `end` at `interval` minutes.
 */
export function generateTimeSlots({
  start = '08:00',
  end = '17:00',
  interval = MINUTE_INTERVAL,
} = {}) {
  const startMin = timeToMinutes(start) ?? 8 * 60;
  const endMin = timeToMinutes(end) ?? 17 * 60;
  const step = Number(interval) > 0 ? Number(interval) : MINUTE_INTERVAL;

  const slots = [];
  if (startMin <= endMin) {
    for (let m = startMin; m <= endMin; m += step) {
      slots.push(minutesToTime(m));
    }
  } else {
    for (let m = startMin; m < 24 * 60; m += step) {
      slots.push(minutesToTime(m));
    }
    for (let m = 0; m <= endMin; m += step) {
      slots.push(minutesToTime(m));
    }
  }
  return slots;
}

/**
 * Returns available time slots for a given date in 24-hour format at 15-min intervals,
 * constrained by working hours and API lead time.
 *
 * @param {string} dateValue YYYY-MM-DD, or '' when no day is chosen yet
 * @param {Date} [now=new Date()]
 * @param {object} [config]
 * @param {string} [config.start='08:00'] Working hours start
 * @param {string} [config.end='17:00'] Working hours end
 * @param {number} [config.interval=15] Minute interval (default 15)
 * @returns {{ slots: string[], options: { id: string, name: string }[] }}
 */
export function timeOptions(dateValue, now = new Date(), config = {}) {
  const {
    start = '08:00',
    end = '17:00',
    interval = MINUTE_INTERVAL,
  } = config;

  const allSlots = generateTimeSlots({ start, end, interval });
  const earliest = earliestMoment(now);
  const day = dateValue ? new Date(`${dateValue}T00:00`) : null;

  let slots = allSlots;

  if (day) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());

    if (targetDay < today) {
      slots = [];
    } else if (isSameDay(day, earliest)) {
      const minMinutes = earliest.getHours() * 60 + earliest.getMinutes();
      slots = allSlots.filter((slot) => {
        const slotMinutes = timeToMinutes(slot);
        return slotMinutes !== null && slotMinutes >= minMinutes;
      });
    }
  }

  return {
    slots,
    options: slots.map((s) => ({ id: s, name: s })),
  };
}

/**
 * Checks if a candidate callback schedule conflicts with any existing callbacks.
 * Two callbacks conflict if they are on the same date and their time windows overlap.
 *
 * @param {object} candidate
 * @param {string} candidate.date YYYY-MM-DD
 * @param {string} candidate.time HH:mm
 * @param {number|string} [candidate.windowMinutes=30]
 * @param {Array} scheduledList List of existing CallbackSchedule objects
 * @param {object} [options]
 * @param {string} [options.excludeId] ID of the callback currently being rescheduled
 * @param {string} [options.myAgentId] Agent ID to scope checks to
 * @returns {object|null} The conflicting callback object, or null
 */
export function findCallbackConflict(candidate, scheduledList = [], { excludeId, myAgentId } = {}) {
  if (!candidate || !candidate.date || !candidate.time) return null;
  const candStart = timeToMinutes(candidate.time);
  if (candStart === null) return null;
  const windowLen = Number(candidate.windowMinutes) || 30;
  const candEnd = candStart + windowLen;

  for (const cb of scheduledList) {
    if (!cb) continue;
    if (excludeId && cb.id === excludeId) continue;
    if (myAgentId && cb.assigneeAgent && cb.assigneeAgent !== myAgentId) continue;
    if (cb.scheduleDate !== candidate.date) continue;

    const cbStart = timeToMinutes(cb.startTime);
    const cbEnd = timeToMinutes(cb.endTime);
    if (cbStart === null || cbEnd === null) continue;

    if (candStart < cbEnd && cbStart < candEnd) {
      return cb;
    }
  }

  return null;
}
