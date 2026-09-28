import { validateLogout } from './logout';

describe('validateLogout (Rule 6 — Logout Validation + Amazon Auto Logout)', () => {
  it('does not trigger when logout is within the default 15m buffer', () => {
    const result = validateLogout({
      payLogout: '18:00',
      appLogout: '17:50',
      lastStop: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger exactly at the buffer boundary (inclusive)', () => {
    const result = validateLogout({
      payLogout: '18:00',
      appLogout: '17:45',
      lastStop: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('triggers when logout exceeds the default 15m buffer', () => {
    const result = validateLogout({
      payLogout: '18:30',
      appLogout: '17:50',
      lastStop: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGOUT_TIME_DIFFERENCE');
    expect(result.detail).toContain('40m');
  });

  it('flags payroll logging out early the same as late (buffer is +/-)', () => {
    const result = validateLogout({
      payLogout: '17:00',
      appLogout: '17:50',
      lastStop: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGOUT_TIME_DIFFERENCE');
  });

  it('does not trigger when payroll logout is missing (defers to Rule 8)', () => {
    const result = validateLogout({
      payLogout: null,
      appLogout: '17:50',
      lastStop: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('Amazon Auto Logout: estimates from last stop and matches payroll within the buffer', () => {
    const result = validateLogout({
      payLogout: '18:00',
      appLogout: null,
      lastStop: '17:45',
    });

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('AMAZON_AUTO_LOGOUT_ESTIMATED');
    expect(result.detail).toContain('17:45');
  });

  it('Amazon Auto Logout: payroll differs from the estimate beyond the buffer', () => {
    const result = validateLogout({
      payLogout: '18:45',
      appLogout: null,
      lastStop: '17:45',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGOUT_TIME_DIFFERENCE');
    expect(result.detail).toContain('estimate');
  });

  it('Amazon Auto Logout (Q18): the estimate step now uses a wider, independent 30m buffer, not the same 15m buffer reused twice', () => {
    const result = validateLogout({
      payLogout: '18:20',
      appLogout: null,
      lastStop: '17:45',
    });

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('AMAZON_AUTO_LOGOUT_ESTIMATED');
    expect(result.detail).toContain('30m');
  });

  it('respects a configured estimate-buffer override, independent from the regular logout buffer', () => {
    const result = validateLogout(
      { payLogout: '18:15', appLogout: null, lastStop: '17:45' },
      { amazonAutoLogoutEstimateBufferMins: 10, logoutBufferMins: 15 },
    );

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGOUT_TIME_DIFFERENCE');
  });

  it('treats an empty-string Amazon logout the same as a null one (falls to estimation path)', () => {
    const result = validateLogout({
      payLogout: '18:00',
      appLogout: '',
      lastStop: '17:45',
    });

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('AMAZON_AUTO_LOGOUT_ESTIMATED');
  });

  it('Q19: flags for manual review when both Amazon logout and last stop are missing, instead of passing silently', () => {
    const result = validateLogout({
      payLogout: '18:00',
      appLogout: null,
      lastStop: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('COMPARISON_DATA_MISSING');
  });

  it('does not trigger the estimation path when payroll logout itself is missing', () => {
    const result = validateLogout({
      payLogout: null,
      appLogout: null,
      lastStop: '17:45',
    });

    expect(result.triggered).toBe(false);
  });

  it('respects a configured buffer override from Settings', () => {
    const withinCustomBuffer = validateLogout(
      { payLogout: '18:00', appLogout: '17:45', lastStop: null },
      { logoutBufferMins: 20 },
    );
    const outsideCustomBuffer = validateLogout(
      { payLogout: '18:00', appLogout: '17:35', lastStop: null },
      { logoutBufferMins: 20 },
    );

    expect(withinCustomBuffer.triggered).toBe(false);
    expect(outsideCustomBuffer.triggered).toBe(true);
  });
});
