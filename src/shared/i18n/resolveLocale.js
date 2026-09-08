/*
 * shared/i18n/resolveLocale.js — pure locale resolution, no chrome/DOM APIs
 * so it's trivially unit-testable (tests/resolveLocale.test.js).
 */
import { DEFAULT_LOCALE, AUTO_LOCALE } from './locales.js';

function normalize(tag) {
  return String(tag || '').trim().toLowerCase().replace('_', '-');
}

/**
 * @param {string} preference    settings.language — a supported code, 'auto', or empty
 * @param {string} browserLanguage  e.g. navigator.language ('de-DE', 'pt-BR', ...)
 * @param {string[]} supported   SUPPORTED_LOCALES
 * @param {string} fallback      DEFAULT_LOCALE
 */
export function resolveLocale(preference, browserLanguage, supported, fallback = DEFAULT_LOCALE) {
  const list = supported || [];
  const pref = normalize(preference);
  if (pref && pref !== AUTO_LOCALE && list.includes(pref)) return pref;

  const browser = normalize(browserLanguage);
  if (browser && list.includes(browser)) return browser;

  const primary = browser.split('-')[0];
  if (primary && list.includes(primary)) return primary;

  return fallback;
}
