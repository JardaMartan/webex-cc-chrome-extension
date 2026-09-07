/*
 * shared/phoneMatcher.js — pure heuristic phone-number detection, used by the
 * content-script popover scanner (widget/phone/phonePopover.js). No DOM/chrome
 * APIs here so it is trivially unit-testable (tests/phoneMatcher.test.js) —
 * same design as the existing crm-clicktocall-extension/contact-scan.js in
 * the sibling task-management project, extended to also catch loose
 * "national format" numbers (that extension only matched strict E.164).
 *
 * Matching an arbitrary CRM's phone numbers is inherently heuristic — tune
 * MIN_DIGITS/MAX_DIGITS and SEPARATOR_RE for your target CRM's formatting.
 */

// A candidate run of digits + common separators, optionally starting with "+"
// or an opening "(" (for "(020) 1234 5678" style formatting). Deliberately
// permissive; validity is decided afterwards by digit count (isPlausiblePhone).
const CANDIDATE_RE = /(?<![\w(])(\+?\(?\d[\d\s().-]{4,18}\d)(?!\w)/g;

const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/** Strip everything but digits and a leading "+". */
export function normalizePhone(raw) {
  const s = String(raw).trim();
  const hasPlus = s.charAt(0) === '+';
  const digits = s.replace(/\D/g, '');
  return (hasPlus ? '+' : '') + digits;
}

/**
 * Convert a normalized candidate to a dialable E.164-ish number. If it
 * already has a "+", it's used as-is. Otherwise, a configured default
 * country calling code is prefixed (best-effort — there is no way to
 * reliably infer a country code from a bare national number).
 */
export function toDialable(normalized, defaultCountryCode) {
  if (normalized.startsWith('+')) return normalized;
  if (defaultCountryCode) return `+${defaultCountryCode}${normalized.replace(/^0+/, '')}`;
  return normalized;
}

export function isPlausiblePhone(normalized) {
  const isE164 = normalized.startsWith('+');
  const digits = isE164 ? normalized.slice(1) : normalized;
  const n = digits.length;
  if (n < MIN_DIGITS || n > MAX_DIGITS) return false;
  // A "+countrycode" number can never start with 0 (E.164 rule). A bare
  // national number commonly DOES start with a trunk prefix "0" (e.g. UK
  // "020...", most of Europe) so no such restriction applies to it.
  return isE164 ? /^[1-9]/.test(digits) : true;
}

// A bare run of digits joined only by dashes/dots reads just as easily as a
// case/order/ticket number ("CASE-2025-0891", "20250514-4421") as a phone
// number, and CRMs are full of those. Only accept a candidate that carries
// an actual phone-number "shape": a leading "+" or international "00", a
// national-format "(area code)", or at least one space — none of which a
// reference/ticket id typically has.
function hasPhoneShape(raw) {
  if (raw.startsWith('+')) return true;
  if (/^00\d/.test(raw)) return true;
  if (/[()]/.test(raw)) return true;
  return /\s/.test(raw);
}

/**
 * Scan free text for phone-number candidates.
 * @param {string} text
 * @returns {{raw:string, value:string}[]} deduped, in first-seen order
 */
export function extractPhoneNumbers(text) {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set();
  const out = [];
  let m;
  CANDIDATE_RE.lastIndex = 0;
  while ((m = CANDIDATE_RE.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!hasPhoneShape(raw)) continue;
    const value = normalizePhone(raw);
    if (!isPlausiblePhone(value) || seen.has(value)) continue;
    seen.add(value);
    out.push({ raw, value });
  }
  return out;
}
