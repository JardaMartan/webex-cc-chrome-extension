import { buildCallbackRequest, earliestStart, MIN_LEAD_MINUTES, guessCustomerName } from '../src/widget/callback/callbackRequest.js';

const NOW = new Date('2026-09-03T10:00:00');
const VALID = {
  customerName: 'Ada Lovelace',
  callbackNumber: '+441952451726',
  startsAt: '2026-09-03T12:00',
  queueId: 'q-1',
  timezone: 'Europe/Prague',
  now: NOW,
};

describe('buildCallbackRequest', () => {
  it('maps the form onto the API contract', () => {
    expect(buildCallbackRequest(VALID)).toEqual({
      customerName: 'Ada Lovelace',
      callbackNumber: '+441952451726',
      timezone: 'Europe/Prague',
      scheduleDate: '2026-09-03',
      startTime: '12:00:00',
      endTime: '12:30:00',
      queueId: 'q-1',
    });
  });

  it('includes the optional fields only when supplied', () => {
    const body = buildCallbackRequest({
      ...VALID,
      callbackReason: 'Customer asked for a call back',
      sourceInteraction: '5fae5753-3105-469d-9c02-6d779acde222',
      assigneeAgent: '3ccdaa41-6c4d-4271-bf2d-745e7bb2ce1f',
    });
    expect(body.callbackReason).toBe('Customer asked for a call back');
    expect(body.sourceInteraction).toBe('5fae5753-3105-469d-9c02-6d779acde222');
    expect(body.assigneeAgent).toBe('3ccdaa41-6c4d-4271-bf2d-745e7bb2ce1f');
  });

  it('derives endTime from the requested window', () => {
    expect(buildCallbackRequest({ ...VALID, windowMinutes: 120 }).endTime).toBe('14:00:00');
  });

  it(`rejects a start less than ${MIN_LEAD_MINUTES} minutes away`, () => {
    expect(() => buildCallbackRequest({ ...VALID, startsAt: '2026-09-03T10:20' })).toThrow(/30 minutes from now/);
  });

  it('rejects a start more than 31 days out', () => {
    expect(() => buildCallbackRequest({ ...VALID, startsAt: '2026-10-20T12:00' })).toThrow(/31 days/);
  });

  it('rejects a window outside 30 minutes to 8 hours', () => {
    expect(() => buildCallbackRequest({ ...VALID, windowMinutes: 15 })).toThrow(/between 30 minutes and 8 hours/);
    expect(() => buildCallbackRequest({ ...VALID, windowMinutes: 600 })).toThrow(/between 30 minutes and 8 hours/);
  });

  it('enforces the callback number format and 7-15 length', () => {
    expect(() => buildCallbackRequest({ ...VALID, callbackNumber: '12345' })).toThrow(/7 to 15 characters/);
    expect(() => buildCallbackRequest({ ...VALID, callbackNumber: '+4419524517261234' })).toThrow(/7 to 15 characters/);
    expect(() => buildCallbackRequest({ ...VALID, callbackNumber: '+44 195 2451' })).not.toThrow();
  });

  it('requires a name, a queue and a time', () => {
    expect(() => buildCallbackRequest({ ...VALID, customerName: '  ' })).toThrow(/customer’s name/);
    expect(() => buildCallbackRequest({ ...VALID, queueId: '' })).toThrow(/queue/);
    expect(() => buildCallbackRequest({ ...VALID, startsAt: '' })).toThrow(/when the callback should start/);
  });

  it('caps the customer name at the documented 250 characters', () => {
    expect(() => buildCallbackRequest({ ...VALID, customerName: 'x'.repeat(251) })).toThrow(/250 characters/);
  });
});

describe('guessCustomerName', () => {
  it('prefers a full-name-shaped CAD field', () => {
    expect(guessCustomerName({ CustomerName: 'Ada Lovelace', FirstName: 'Ada', LastName: 'Lovelace' })).toBe(
      'Ada Lovelace'
    );
  });

  it('matches full-name keys case/separator-insensitively', () => {
    expect(guessCustomerName({ full_name: 'Grace Hopper' })).toBe('Grace Hopper');
    expect(guessCustomerName({ ContactName: 'Alan Turing' })).toBe('Alan Turing');
  });

  it('falls back to combining first + last name', () => {
    expect(guessCustomerName({ FirstName: 'Katherine', LastName: 'Johnson' })).toBe('Katherine Johnson');
  });

  it('uses only whichever of first/last name is present', () => {
    expect(guessCustomerName({ FirstName: 'Margaret' })).toBe('Margaret');
  });

  it('ignores blank values and unrelated CAD fields', () => {
    expect(guessCustomerName({ AccountId: '12345', CustomerName: '   ' })).toBe('');
  });

  it('returns an empty string when there is nothing to go on', () => {
    expect(guessCustomerName(null)).toBe('');
    expect(guessCustomerName({})).toBe('');
  });
});

describe('earliestStart', () => {
  it('offers the first datetime-local value the API would accept', () => {
    expect(earliestStart(NOW)).toBe('2026-09-03T10:30');
  });
});
