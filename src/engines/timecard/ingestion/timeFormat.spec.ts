import {
  convertTo24Hour,
  normalizeDateToIso,
  normalizeName,
} from './timeFormat';

describe('convertTo24Hour', () => {
  it('converts a 12-hour AM time with a space, as in the real Payroll Export', () => {
    expect(convertTo24Hour('10:45 AM')).toBe('10:45');
  });

  it('converts a 12-hour PM time with a space', () => {
    expect(convertTo24Hour('04:47 PM')).toBe('16:47');
  });

  it('converts a lowercase, no-space time, as in the real Amazon Itinerary', () => {
    expect(convertTo24Hour('10:58am')).toBe('10:58');
  });

  it('converts 12:00 PM to noon (12:00)', () => {
    expect(convertTo24Hour('12:00 PM')).toBe('12:00');
  });

  it('converts 12:00 AM to midnight (00:00)', () => {
    expect(convertTo24Hour('12:00 AM')).toBe('00:00');
  });

  it('treats the literal "Missing" placeholder as null', () => {
    expect(convertTo24Hour('Missing')).toBeNull();
  });

  it('treats an empty or whitespace-only string as null', () => {
    expect(convertTo24Hour('')).toBeNull();
    expect(convertTo24Hour('   ')).toBeNull();
  });

  it('treats null/undefined as null', () => {
    expect(convertTo24Hour(null)).toBeNull();
    expect(convertTo24Hour(undefined)).toBeNull();
  });

  it('passes through a date-prefixed malformed value unchanged, rather than guessing', () => {
    expect(convertTo24Hour('Jul 7 3:08am')).toBe('Jul 7 3:08am');
  });

  it('strips seconds from a 24-hour time, as in the real DA Break Utilization file', () => {
    expect(convertTo24Hour('15:02:09')).toBe('15:02');
  });

  it('pads a single-digit hour when stripping seconds', () => {
    expect(convertTo24Hour('9:05:30')).toBe('09:05');
  });
});

describe('normalizeDateToIso', () => {
  it('extracts the date portion from an ISO datetime string', () => {
    expect(normalizeDateToIso('2026-07-08T00:00:00.000Z')).toBe('2026-07-08');
  });

  it('extracts the date from a plain ISO date string', () => {
    expect(normalizeDateToIso('2026-07-08')).toBe('2026-07-08');
  });

  it('converts a Date object to an ISO date string', () => {
    expect(normalizeDateToIso(new Date('2026-07-08T00:00:00.000Z'))).toBe(
      '2026-07-08',
    );
  });

  it('returns null for an invalid Date object', () => {
    expect(normalizeDateToIso(new Date('not a date'))).toBeNull();
  });

  it('returns null for null/undefined/empty', () => {
    expect(normalizeDateToIso(null)).toBeNull();
    expect(normalizeDateToIso(undefined)).toBeNull();
    expect(normalizeDateToIso('')).toBeNull();
  });
});

describe('normalizeName', () => {
  it('trims whitespace', () => {
    expect(normalizeName('  Alarcon, Jose  ')).toBe('Alarcon, Jose');
  });

  it('treats the literal "Missing" placeholder as null', () => {
    expect(normalizeName('Missing')).toBeNull();
  });

  it('treats empty/null/undefined as null', () => {
    expect(normalizeName('')).toBeNull();
    expect(normalizeName(null)).toBeNull();
    expect(normalizeName(undefined)).toBeNull();
  });
});
