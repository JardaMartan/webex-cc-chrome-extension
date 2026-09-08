/*
 * shared/i18n/locales.js — the set of supported UI locales: all 24 official
 * EU languages, plus the Western Balkans (non-EU) and Ukrainian, per the
 * localization request. Codes are ISO 639-1; NATIVE_NAMES are autonyms, used
 * to label the language picker in the widget's own Settings panel so every
 * agent can find their language regardless of which language the UI is
 * currently showing.
 */
export const DEFAULT_LOCALE = 'en';

// 'auto' = follow the resolved page/browser language (see resolveLocale.js);
// not itself a translation set.
export const AUTO_LOCALE = 'auto';

export const SUPPORTED_LOCALES = [
  'bg', // Bulgarian
  'hr', // Croatian
  'cs', // Czech
  'da', // Danish
  'nl', // Dutch
  'en', // English
  'et', // Estonian
  'fi', // Finnish
  'fr', // French
  'de', // German
  'el', // Greek
  'hu', // Hungarian
  'ga', // Irish
  'it', // Italian
  'lv', // Latvian
  'lt', // Lithuanian
  'mt', // Maltese
  'pl', // Polish
  'pt', // Portuguese
  'ro', // Romanian
  'sk', // Slovak
  'sl', // Slovenian
  'es', // Spanish
  'sv', // Swedish
  // Western Balkans (non-EU)
  'sq', // Albanian
  'bs', // Bosnian
  'mk', // Macedonian
  'sr', // Serbian
  // Ukraine
  'uk', // Ukrainian
];

export const NATIVE_NAMES = {
  bg: 'Български',
  hr: 'Hrvatski',
  cs: 'Čeština',
  da: 'Dansk',
  nl: 'Nederlands',
  en: 'English',
  et: 'Eesti',
  fi: 'Suomi',
  fr: 'Français',
  de: 'Deutsch',
  el: 'Ελληνικά',
  hu: 'Magyar',
  ga: 'Gaeilge',
  it: 'Italiano',
  lv: 'Latviešu',
  lt: 'Lietuvių',
  mt: 'Malti',
  pl: 'Polski',
  pt: 'Português',
  ro: 'Română',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  es: 'Español',
  sv: 'Svenska',
  sq: 'Shqip',
  bs: 'Bosanski',
  mk: 'Македонски',
  sr: 'Српски',
  uk: 'Українська',
};
