import { parseTimeToMinutes, minutesDiff } from './time';

describe('parseTimeToMinutes', () => {
  it('parses a valid HH:MM time', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('trims surrounding whitespace', () => {
    expect(parseTimeToMinutes(' 09:30 ')).toBe(570);
  });

  it('returns null for missing values', () => {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
    expect(parseTimeToMinutes('')).toBeNull();
  });

  it('returns null for an invalid format', () => {
    expect(parseTimeToMinutes('9:30am')).toBeNull();
    expect(parseTimeToMinutes('not a time')).toBeNull();
  });

  it('returns null for out-of-range hours or minutes', () => {
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('12:60')).toBeNull();
  });
});

describe('minutesDiff', () => {
  it('computes an absolute difference regardless of direction', () => {
    expect(minutesDiff('09:30', '09:33')).toBe(3);
    expect(minutesDiff('09:33', '09:30')).toBe(3);
  });

  it('returns 0 for identical times', () => {
    expect(minutesDiff('09:30', '09:30')).toBe(0);
  });

  it('returns null when either time is missing or invalid', () => {
    expect(minutesDiff(null, '09:30')).toBeNull();
    expect(minutesDiff('09:30', undefined)).toBeNull();
    expect(minutesDiff('bad', '09:30')).toBeNull();
  });
});
