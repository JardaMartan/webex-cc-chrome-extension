const { resolveLocale } = require('../src/shared/i18n/resolveLocale.js');

const SUPPORTED = ['en', 'de', 'fr', 'cs', 'pt'];

describe('resolveLocale', () => {
  test('an explicit supported preference wins', () => {
    expect(resolveLocale('de', 'en-US', SUPPORTED)).toBe('de');
  });

  test('falls back to the browser language on "auto"', () => {
    expect(resolveLocale('auto', 'fr-FR', SUPPORTED)).toBe('fr');
  });

  test('falls back to the browser language when no preference is set', () => {
    expect(resolveLocale('', 'cs-CZ', SUPPORTED)).toBe('cs');
  });

  test('matches the primary subtag when the full tag is unsupported', () => {
    expect(resolveLocale('auto', 'pt-BR', SUPPORTED)).toBe('pt');
  });

  test('falls back to the default locale when nothing matches', () => {
    expect(resolveLocale('auto', 'ja-JP', SUPPORTED)).toBe('en');
  });

  test('an unsupported explicit preference falls back to the browser language', () => {
    expect(resolveLocale('xx', 'de-DE', SUPPORTED)).toBe('de');
  });
});
