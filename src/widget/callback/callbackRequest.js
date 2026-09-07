/*
 * widget/callback/callbackRequest.js — builds and validates a Webex Contact
 * Center "Schedule a Callback" request.
 *
 * Contract (POST /v1/callbacks/organization/{orgId}/scheduled-callback):
 *   customerName*  max 250 chars
 *   callbackNumber* 7–15 chars, optional country code then digits and " -().",
 *   timezone*      IANA name
 *   scheduleDate*  YYYY-MM-DD, within 31 days, local time zone
 *   startTime*     HH:mm:ss, at least 30 minutes in the future
 *   endTime*       HH:mm:ss, 30 minutes to 8 hours after startTime
 *   queueId*
 *   callbackReason / sourceInteraction / assigneeAgent  optional
 *
 * The rules are enforced here so the agent gets a specific message instead of
 * a bare 400 from the API after filling the whole form in.
 */

export const MIN_LEAD_MINUTES = 30;
export const MIN_WINDOW_MINUTES = 30;
export const MAX_WINDOW_MINUTES = 8 * 60;
export const MAX_DAYS_AHEAD = 31;

const MINUTE = 60 * 1000;

// Total length 7–15 including the optional "+" and the permitted separators.
const CALLBACK_NUMBER_RE = /^\+?[\d\s\-().]{6,14}$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function toClockTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (err) {
    return 'UTC';
  }
}

/** Earliest datetime-local value the API would accept, for the form's `min`. */
export function earliestStart(now = new Date()) {
  const start = new Date(now.getTime() + MIN_LEAD_MINUTES * MINUTE);
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
}

/** Recovers the window length from an existing callback's start/end times. */
export function windowMinutesBetween(startTime, endTime) {
  const toMinutes = (t) => {
    const [h, m] = String(t || '').split(':').map(Number);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return MIN_WINDOW_MINUTES;
  // A window may run past midnight into the next day.
  const diff = end >= start ? end - start : end + 24 * 60 - start;
  return diff || MIN_WINDOW_MINUTES;
}

/**
 * @param startsAt native <input type="datetime-local"> value, e.g. 2026-09-04T15:30
 * @returns the API request body
 * @throws Error with an agent-readable message when a rule is broken
 */
export function buildCallbackRequest({
  customerName,
  callbackNumber,
  startsAt,
  windowMinutes = MIN_WINDOW_MINUTES,
  queueId,
  callbackReason,
  sourceInteraction,
  assigneeAgent,
  timezone = localTimezone(),
  now = new Date(),
}) {
  const name = (customerName || '').trim();
  if (!name) throw new Error('Enter the customer’s name.');
  if (name.length > 250) throw new Error('The customer name must be 250 characters or fewer.');

  const number = (callbackNumber || '').trim();
  if (!CALLBACK_NUMBER_RE.test(number) || number.length < 7 || number.length > 15) {
    throw new Error('Enter a callback number of 7 to 15 characters (digits, spaces, - ( ) . and an optional +).');
  }

  if (!queueId) throw new Error('Choose the queue that should handle the callback.');
  if (!startsAt) throw new Error('Choose when the callback should start.');

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) throw new Error('Choose a valid callback date and time.');

  if (start.getTime() < now.getTime() + MIN_LEAD_MINUTES * MINUTE) {
    throw new Error(`The callback must start at least ${MIN_LEAD_MINUTES} minutes from now.`);
  }
  const latest = new Date(now.getTime());
  latest.setDate(latest.getDate() + MAX_DAYS_AHEAD);
  if (start.getTime() > latest.getTime()) {
    throw new Error(`The callback must be within ${MAX_DAYS_AHEAD} days from now.`);
  }

  if (windowMinutes < MIN_WINDOW_MINUTES || windowMinutes > MAX_WINDOW_MINUTES) {
    throw new Error(`The callback window must be between ${MIN_WINDOW_MINUTES} minutes and 8 hours.`);
  }
  const end = new Date(start.getTime() + windowMinutes * MINUTE);

  return {
    customerName: name,
    callbackNumber: number,
    timezone,
    scheduleDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startTime: toClockTime(start),
    endTime: toClockTime(end),
    queueId,
    ...(callbackReason ? { callbackReason } : {}),
    ...(sourceInteraction ? { sourceInteraction } : {}),
    ...(assigneeAgent ? { assigneeAgent } : {}),
  };
}
