const { extractPhoneNumbers, normalizePhone, isPlausiblePhone, toDialable } = require('../src/shared/phoneMatcher.js');

describe('phoneMatcher', () => {
  test('extracts a strict E.164 number', () => {
    const found = extractPhoneNumbers('Call our support line at +1 415-555-0134 for help.');
    expect(found).toEqual([{ raw: '+1 415-555-0134', value: '+14155550134' }]);
  });

  test('extracts a loose national-format number', () => {
    const found = extractPhoneNumbers('Office: (020) 7946 0958');
    expect(found).toEqual([{ raw: '(020) 7946 0958', value: '02079460958' }]);
  });

  test('ignores short digit runs (e.g. a year or a small id)', () => {
    expect(extractPhoneNumbers('Invoice #2024, due in 30 days')).toEqual([]);
  });

  test('ignores dash-joined reference/ticket ids with no phone shape', () => {
    expect(extractPhoneNumbers('See case CASE-2025-0891 for details')).toEqual([]);
    expect(extractPhoneNumbers('Order 20250514-4421 was shipped')).toEqual([]);
  });

  test('still extracts a bare national number once it has a phone shape', () => {
    expect(extractPhoneNumbers('Call 020 7946 0958 now')).toEqual([{ raw: '020 7946 0958', value: '02079460958' }]);
    expect(extractPhoneNumbers('Dial 0044 20 7946 0958')).toEqual([
      { raw: '0044 20 7946 0958', value: '00442079460958' },
    ]);
  });

  test('dedupes repeated numbers', () => {
    const found = extractPhoneNumbers('+14155550134 and again +1 415 555 0134');
    expect(found).toHaveLength(1);
  });

  test('normalizePhone keeps a leading + and strips separators', () => {
    expect(normalizePhone('+1 (415) 555-0134')).toBe('+14155550134');
  });

  test('isPlausiblePhone rejects numbers outside 7-15 digits', () => {
    expect(isPlausiblePhone('123456')).toBe(false);
    expect(isPlausiblePhone('+1234567')).toBe(true);
    expect(isPlausiblePhone('1234567890123456')).toBe(false);
  });

  test('toDialable prefixes a default country code for bare national numbers', () => {
    expect(toDialable('02079460958', '44')).toBe('+442079460958');
    expect(toDialable('+14155550134', '44')).toBe('+14155550134');
  });
});
