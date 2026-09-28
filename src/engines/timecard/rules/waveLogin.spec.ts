import { validateWaveLogin } from './waveLogin';

describe('validateWaveLogin (Rule 2 — Wave Login Validation)', () => {
  it('does not trigger when login is well within the default 5m buffer', () => {
    const result = validateWaveLogin({
      payLogin: '09:33',
      waveStartTime: '09:30',
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger exactly at the buffer boundary (inclusive)', () => {
    const result = validateWaveLogin({
      payLogin: '09:35',
      waveStartTime: '09:30',
    });

    expect(result.triggered).toBe(false);
  });

  it('triggers when login exceeds the default 5m buffer', () => {
    const result = validateWaveLogin({
      payLogin: '09:50',
      waveStartTime: '09:30',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('WAVE_LOGIN_DIFFERENCE');
    expect(result.detail).toContain('20m');
  });

  it('flags an early login the same as a late one (buffer is +/-)', () => {
    const result = validateWaveLogin({
      payLogin: '09:00',
      waveStartTime: '09:30',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('WAVE_LOGIN_DIFFERENCE');
  });

  it('does not trigger when payroll login is missing', () => {
    const result = validateWaveLogin({
      payLogin: null,
      waveStartTime: '09:30',
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when no wave is assigned', () => {
    const result = validateWaveLogin({
      payLogin: '09:33',
      waveStartTime: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when both payroll login and wave start are missing (Q19 is scoped to Rules 3 & 6 only, not Rule 2 -- see BACKEND_FOUNDATION_PLAN.md)', () => {
    const result = validateWaveLogin({
      payLogin: null,
      waveStartTime: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('respects a configured buffer override from Settings', () => {
    const withinCustomBuffer = validateWaveLogin(
      { payLogin: '09:38', waveStartTime: '09:30' },
      { waveLoginBufferMins: 10 },
    );
    const outsideCustomBuffer = validateWaveLogin(
      { payLogin: '09:42', waveStartTime: '09:30' },
      { waveLoginBufferMins: 10 },
    );

    expect(withinCustomBuffer.triggered).toBe(false);
    expect(outsideCustomBuffer.triggered).toBe(true);
  });
});
