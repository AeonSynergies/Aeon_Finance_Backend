import { validateLoginVsAmazon } from './loginVsAmazon';

describe('validateLoginVsAmazon (Rule 3 — Payroll Login vs Amazon Login)', () => {
  it('does not trigger when login is well within the default 30m buffer', () => {
    const result = validateLoginVsAmazon({
      payLogin: '09:33',
      appLogin: '10:00',
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger exactly at the buffer boundary (inclusive)', () => {
    const result = validateLoginVsAmazon({
      payLogin: '09:30',
      appLogin: '10:00',
    });

    expect(result.triggered).toBe(false);
  });

  it('triggers when login exceeds the default 30m buffer', () => {
    const result = validateLoginVsAmazon({
      payLogin: '09:33',
      appLogin: '10:10',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGIN_TIME_DIFFERENCE');
    expect(result.detail).toContain('37m');
  });

  it('flags payroll being ahead of Amazon the same as behind it (buffer is +/-)', () => {
    const result = validateLoginVsAmazon({
      payLogin: '10:00',
      appLogin: '09:20',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGIN_TIME_DIFFERENCE');
  });

  it('does not trigger when payroll login is missing', () => {
    const result = validateLoginVsAmazon({ payLogin: null, appLogin: '09:30' });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when Amazon login is missing', () => {
    const result = validateLoginVsAmazon({ payLogin: '09:33', appLogin: null });

    expect(result.triggered).toBe(false);
  });

  it('Q19: flags for manual review when both payroll login and Amazon login are missing, instead of passing silently', () => {
    const result = validateLoginVsAmazon({ payLogin: null, appLogin: null });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('COMPARISON_DATA_MISSING');
  });

  it('respects a configured buffer override from Settings', () => {
    const withinCustomBuffer = validateLoginVsAmazon(
      { payLogin: '09:33', appLogin: '09:45' },
      { amazonLoginBufferMins: 15 },
    );
    const outsideCustomBuffer = validateLoginVsAmazon(
      { payLogin: '09:33', appLogin: '09:50' },
      { amazonLoginBufferMins: 15 },
    );

    expect(withinCustomBuffer.triggered).toBe(false);
    expect(outsideCustomBuffer.triggered).toBe(true);
  });
});
