import { checkGarbledTimeValues } from './garbledTimeCheck';

function baseInput() {
  return {
    payLogin: '09:00',
    payLogout: '18:00',
    payBreakOut: '12:00',
    payBreakIn: '12:30',
    waveStartTime: '09:00',
    appLogin: '09:00',
    appLogout: '18:00',
    physicalLogin: null,
    lastStop: null,
  };
}

describe('checkGarbledTimeValues (Q21 — unreadable/garbled time values)', () => {
  it('does not trigger when every field is clean', () => {
    const result = checkGarbledTimeValues(baseInput());

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when fields are genuinely blank (null)', () => {
    const result = checkGarbledTimeValues({
      ...baseInput(),
      payLogin: null,
      waveStartTime: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when a field is an empty string', () => {
    const result = checkGarbledTimeValues({ ...baseInput(), payLogin: '' });

    expect(result.triggered).toBe(false);
  });

  it('flags a garbled value like "N/A"', () => {
    const result = checkGarbledTimeValues({ ...baseInput(), payLogin: 'N/A' });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('UNREADABLE_TIME_VALUE');
    expect(result.detail).toContain('payLogin');
    expect(result.detail).toContain('N/A');
  });

  it('flags an impossible time like "99:99"', () => {
    const result = checkGarbledTimeValues({
      ...baseInput(),
      appLogout: '99:99',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('UNREADABLE_TIME_VALUE');
    expect(result.detail).toContain('appLogout');
  });

  it('checks every field, not just payLogin', () => {
    const fields = [
      'payLogin',
      'payLogout',
      'payBreakOut',
      'payBreakIn',
      'waveStartTime',
      'appLogin',
      'appLogout',
      'physicalLogin',
      'lastStop',
    ] as const;

    for (const field of fields) {
      const result = checkGarbledTimeValues({
        ...baseInput(),
        [field]: 'garbage',
      });
      expect(result.triggered).toBe(true);
      expect(result.detail).toContain(field);
    }
  });
});
