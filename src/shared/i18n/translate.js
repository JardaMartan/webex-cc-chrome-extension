/*
 * shared/i18n/translate.js — minimal, dependency-free string lookup +
 * `{param}` interpolation. English (messages.en) is the fallback for any key
 * missing from a locale's dictionary or for an unsupported locale, so a
 * partial/incorrect translation never surfaces a raw key to the agent.
 */
import { MESSAGES } from './messages.js';
import { DEFAULT_LOCALE } from './locales.js';

export function t(locale, key, params) {
  const dict = MESSAGES[locale] || MESSAGES[DEFAULT_LOCALE];
  let str = dict[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (params) {
    for (const name of Object.keys(params)) {
      str = str.split(`{${name}}`).join(String(params[name]));
    }
  }
  return str;
}
