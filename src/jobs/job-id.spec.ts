import { generateJobId } from './job-id';

describe('generateJobId', () => {
  it('matches the BRS weekly worked example exactly (TC-2026-W28)', () => {
    expect(generateJobId('WEEKLY', new Date('2026-07-05T00:00:00Z'))).toBe(
      'TC-2026-W28',
    );
  });

  it('matches the BRS biweekly worked example exactly (TC-2026-W27-W28)', () => {
    expect(generateJobId('BIWEEKLY', new Date('2026-06-28T00:00:00Z'))).toBe(
      'TC-2026-W27-W28',
    );
  });

  it('rolls a late-December Sunday into week 1 of the following ISO year', () => {
    expect(generateJobId('WEEKLY', new Date('2025-12-28T00:00:00Z'))).toBe(
      'TC-2026-W01',
    );
  });

  it('handles a year with 53 ISO weeks', () => {
    expect(generateJobId('WEEKLY', new Date('2026-12-27T00:00:00Z'))).toBe(
      'TC-2026-W53',
    );
  });

  it('handles an early-January Sunday correctly', () => {
    expect(generateJobId('WEEKLY', new Date('2027-01-03T00:00:00Z'))).toBe(
      'TC-2027-W01',
    );
  });

  it('formats a DAILY job as a plain calendar date', () => {
    expect(generateJobId('DAILY', new Date('2026-07-06T00:00:00Z'))).toBe(
      'TC-2026-07-06',
    );
  });

  it('pads single-digit week numbers to 2 digits', () => {
    expect(generateJobId('WEEKLY', new Date('2026-01-04T00:00:00Z'))).toBe(
      'TC-2026-W02',
    );
  });
});
