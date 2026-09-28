import { validatePhysicalTimesheet } from './physicalTimesheet';

describe('validatePhysicalTimesheet (Rule 4 — Physical Timesheet Validation)', () => {
  it('does not trigger when the Physical Timesheet does not exist', () => {
    const result = validatePhysicalTimesheet({
      payLogin: '09:30',
      physicalLogin: null,
      appLogin: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when Amazon Login is available, regardless of Physical Timesheet mismatch (Amazon overrides)', () => {
    const result = validatePhysicalTimesheet({
      payLogin: '09:30',
      physicalLogin: '10:00',
      appLogin: '09:32',
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when Amazon Login is unavailable but Physical Timesheet is within the default 5m buffer', () => {
    const result = validatePhysicalTimesheet({
      payLogin: '09:30',
      physicalLogin: '09:33',
      appLogin: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger exactly at the buffer boundary (inclusive)', () => {
    const result = validatePhysicalTimesheet({
      payLogin: '09:30',
      physicalLogin: '09:35',
      appLogin: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('triggers when Amazon Login is unavailable and Physical Timesheet exceeds the default 5m buffer', () => {
    const result = validatePhysicalTimesheet({
      payLogin: '09:30',
      physicalLogin: '09:40',
      appLogin: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGIN_TIME_DIFFERENCE');
    expect(result.detail).toContain('10m');
  });

  it('flags a late Physical Timesheet login the same as an early one (buffer is +/-)', () => {
    const result = validatePhysicalTimesheet({
      payLogin: '09:30',
      physicalLogin: '09:15',
      appLogin: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGIN_TIME_DIFFERENCE');
  });

  it('does not trigger when payroll login is missing (defers to Rule 7)', () => {
    const result = validatePhysicalTimesheet({
      payLogin: null,
      physicalLogin: '09:40',
      appLogin: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('treats an empty-string Amazon Login as unavailable, consistent with the rest of the engine', () => {
    const result = validatePhysicalTimesheet({
      payLogin: '09:30',
      physicalLogin: '09:40',
      appLogin: '',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('LOGIN_TIME_DIFFERENCE');
  });

  it('respects a configured buffer override from Settings', () => {
    const withinCustomBuffer = validatePhysicalTimesheet(
      { payLogin: '09:30', physicalLogin: '09:38', appLogin: null },
      { physicalLoginBufferMins: 10 },
    );
    const outsideCustomBuffer = validatePhysicalTimesheet(
      { payLogin: '09:30', physicalLogin: '09:45', appLogin: null },
      { physicalLoginBufferMins: 10 },
    );

    expect(withinCustomBuffer.triggered).toBe(false);
    expect(outsideCustomBuffer.triggered).toBe(true);
  });
});
