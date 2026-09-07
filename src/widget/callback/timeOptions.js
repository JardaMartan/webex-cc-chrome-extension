/*
 * widget/callback/timeOptions.js — hour/minute choices for the callback time
 * picker. DOM-free so the "never in the past" rule can be unit-tested.
 */
import { MIN_LEAD_MINUTES } from './callbackRequest.js';

const MINUTE = 60 * 1000;
export const MINUTE_STEP = 5;

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Earliest selectable moment: the API needs a 30-minute lead time. */
export function earliestMoment(now = new Date()) {
  return new Date(now.getTime() + MIN_LEAD_MINUTES * MINUTE);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * @param dateValue YYYY-MM-DD, or '' when no day is chosen yet
 * @returns { hours: string[], minutesFor(hour): string[] }
 */
export function timeOptions(dateValue, now = new Date()) {
  const earliest = earliestMoment(now);
  const day = dateValue ? new Date(`${dateValue}T00:00`) : null;
  // Only the first selectable day is constrained; later days are wide open.
  const limited = !!day && isSameDay(day, earliest);
  const minHour = limited ? earliest.getHours() : 0;

  const hours = [];
  for (let h = minHour; h < 24; h += 1) hours.push(pad(h));

  const minutesFor = (hour) => {
    const h = Number(hour);
    const floor = limited && h === earliest.getHours() ? earliest.getMinutes() : 0;
    const minutes = [];
    for (let m = 0; m < 60; m += MINUTE_STEP) if (m >= floor) minutes.push(pad(m));
    return minutes;
  };

  return { hours, minutesFor };
}
