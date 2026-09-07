/*
 * widget/callback/calendarGrid.js — date maths for the callback calendar.
 * DOM-free so the grid and its bounds can be unit-tested.
 */

export const WEEK_LENGTH = 7;

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function toDateValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addMonths(date, delta) {
  // Day 1 avoids the classic "31 Jan + 1 month = 3 Mar" overflow.
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/**
 * Weeks of `month`, padded with the surrounding months' days so every row has
 * seven entries. Monday-first, matching the Momentum calendar.
 */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % WEEK_LENGTH; // Sunday=0 -> Monday-first
  const start = new Date(year, month, 1 - offset);
  const weeks = [];
  const cursor = new Date(start);
  do {
    const week = [];
    for (let i = 0; i < WEEK_LENGTH; i += 1) {
      week.push({ date: new Date(cursor), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === month && cursor.getFullYear() === year);
  return weeks;
}

/**
 * A day is selectable only inside the window the callback API accepts: from
 * today up to `maxDaysAhead` days out. Past days are never selectable.
 */
export function isSelectableDay(date, { now = new Date(), maxDaysAhead = 31 } = {}) {
  const day = startOfDay(date).getTime();
  const today = startOfDay(now).getTime();
  const last = startOfDay(now);
  last.setDate(last.getDate() + maxDaysAhead);
  return day >= today && day <= last.getTime();
}
