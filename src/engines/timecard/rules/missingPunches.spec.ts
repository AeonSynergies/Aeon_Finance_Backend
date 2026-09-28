import {
  validateMissingLogin,
  validateMissingLogout,
  validateMissingBreak,
} from './missingPunches';

describe('validateMissingLogin (Rule 7 — Missing Login)', () => {
  it('triggers when payroll login is null but logout is present', () => {
    const result = validateMissingLogin({ payLogin: null, payLogout: '18:00' });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_PAYROLL_LOGIN');
  });

  it('triggers when payroll login is an empty string but logout is present', () => {
    const result = validateMissingLogin({ payLogin: '', payLogout: '18:00' });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_PAYROLL_LOGIN');
  });

  it('does not trigger when payroll login is present', () => {
    const result = validateMissingLogin({
      payLogin: '09:30',
      payLogout: '18:00',
    });

    expect(result.triggered).toBe(false);
  });

  it('Q24: reports MISSING_PUNCH instead of MISSING_PAYROLL_LOGIN when both login and logout are missing', () => {
    const result = validateMissingLogin({ payLogin: null, payLogout: null });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_PUNCH');
  });

  it('Q24: reports MISSING_PUNCH when both are empty strings, not just null', () => {
    const result = validateMissingLogin({ payLogin: '', payLogout: '' });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_PUNCH');
  });
});

describe('validateMissingLogout (Rule 8 — Missing Logout)', () => {
  it('triggers when payroll logout is null but login is present', () => {
    const result = validateMissingLogout({
      payLogin: '09:30',
      payLogout: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_PAYROLL_LOGOUT');
  });

  it('triggers when payroll logout is an empty string but login is present', () => {
    const result = validateMissingLogout({ payLogin: '09:30', payLogout: '' });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_PAYROLL_LOGOUT');
  });

  it('does not trigger when payroll logout is present', () => {
    const result = validateMissingLogout({
      payLogin: '09:30',
      payLogout: '18:00',
    });

    expect(result.triggered).toBe(false);
  });

  it('Q24: does not trigger on its own when both are missing -- that combined case is reported by validateMissingLogin as MISSING_PUNCH instead', () => {
    const result = validateMissingLogout({ payLogin: null, payLogout: null });

    expect(result.triggered).toBe(false);
  });
});

describe('validateMissingBreak (Rule 9 — Missing Break)', () => {
  it('triggers when Amazon shows a break but payroll break is missing', () => {
    const result = validateMissingBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: null,
      payBreakIn: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_MEAL_BREAK');
  });

  it('does not trigger when both Amazon and payroll have a break', () => {
    const result = validateMissingBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when neither Amazon nor payroll has a break', () => {
    const result = validateMissingBreak({
      amazonBreaks: [],
      payBreakOut: null,
      payBreakIn: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when payroll has a break but Amazon does not (Rule 5 Exception 4 territory, not this rule)', () => {
    const result = validateMissingBreak({
      amazonBreaks: [],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
    });

    expect(result.triggered).toBe(false);
  });

  it('triggers when payroll break fields are empty strings, not just null', () => {
    const result = validateMissingBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: '',
      payBreakIn: '',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_MEAL_BREAK');
  });

  it('triggers when payroll break is only partially recorded', () => {
    const result = validateMissingBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: '12:00',
      payBreakIn: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('MISSING_MEAL_BREAK');
  });
});
