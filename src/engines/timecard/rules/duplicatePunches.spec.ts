import {
  validateDuplicateBreak,
  validateDuplicatePunch,
} from './duplicatePunches';

describe('validateDuplicateBreak (Rule 10 — Duplicate Break)', () => {
  it('does not trigger when payroll has no breaks', () => {
    const result = validateDuplicateBreak([]);

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when payroll has exactly one break', () => {
    const result = validateDuplicateBreak([
      { breakOut: '12:00', breakIn: '12:30' },
    ]);

    expect(result.triggered).toBe(false);
  });

  it('triggers when payroll has two breaks', () => {
    const result = validateDuplicateBreak([
      { breakOut: '11:00', breakIn: '11:15' },
      { breakOut: '15:00', breakIn: '15:15' },
    ]);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_BREAK');
  });

  it('triggers when payroll has more than two breaks', () => {
    const result = validateDuplicateBreak([
      { breakOut: '10:00', breakIn: '10:10' },
      { breakOut: '12:00', breakIn: '12:30' },
      { breakOut: '15:00', breakIn: '15:10' },
    ]);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_BREAK');
    expect(result.detail).toContain('3');
  });

  it('is exempt from Duplicate Break when the driver is in CA with a signed meal waiver', () => {
    const result = validateDuplicateBreak(
      [
        { breakOut: '11:00', breakIn: '11:15' },
        { breakOut: '15:00', breakIn: '15:15' },
      ],
      { employeeState: 'CA', hasSignedMealWaiver: true },
    );

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('MEAL_WAIVER_EXEMPT');
  });

  it('is exempt in TX too, and the state check is case-insensitive', () => {
    const result = validateDuplicateBreak(
      [
        { breakOut: '11:00', breakIn: '11:15' },
        { breakOut: '15:00', breakIn: '15:15' },
      ],
      { employeeState: 'tx', hasSignedMealWaiver: true },
    );

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('MEAL_WAIVER_EXEMPT');
  });

  it('still triggers Duplicate Break for a non-exempt state even with a signed waiver', () => {
    const result = validateDuplicateBreak(
      [
        { breakOut: '11:00', breakIn: '11:15' },
        { breakOut: '15:00', breakIn: '15:15' },
      ],
      { employeeState: 'NY', hasSignedMealWaiver: true },
    );

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_BREAK');
  });

  it('still triggers Duplicate Break in an exempt state when the waiver is not signed', () => {
    const result = validateDuplicateBreak(
      [
        { breakOut: '11:00', breakIn: '11:15' },
        { breakOut: '15:00', breakIn: '15:15' },
      ],
      { employeeState: 'CA', hasSignedMealWaiver: false },
    );

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_BREAK');
  });

  it('the waiver exemption only covers exactly a second break, not a third or more', () => {
    const result = validateDuplicateBreak(
      [
        { breakOut: '10:00', breakIn: '10:10' },
        { breakOut: '12:00', breakIn: '12:30' },
        { breakOut: '15:00', breakIn: '15:10' },
      ],
      { employeeState: 'CA', hasSignedMealWaiver: true },
    );

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_BREAK');
  });

  it('respects a configured exempt-states list from Settings', () => {
    const result = validateDuplicateBreak(
      [
        { breakOut: '11:00', breakIn: '11:15' },
        { breakOut: '15:00', breakIn: '15:15' },
      ],
      { employeeState: 'WA', hasSignedMealWaiver: true },
      { mealWaiverExemptStates: ['WA'] },
    );

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('MEAL_WAIVER_EXEMPT');
  });
});

describe('validateDuplicatePunch (Rule 11 — Duplicate Punches)', () => {
  it('does not trigger with exactly one login and one logout', () => {
    const result = validateDuplicatePunch(['09:00'], ['18:00']);

    expect(result.triggered).toBe(false);
  });

  it("does not trigger when logins/logouts are empty (not this rule's concern)", () => {
    const result = validateDuplicatePunch([], []);

    expect(result.triggered).toBe(false);
  });

  it('triggers when there are multiple logins', () => {
    const result = validateDuplicatePunch(['09:00', '09:15'], ['18:00']);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_PUNCH');
    expect(result.detail).toContain('2 logins');
  });

  it('triggers when there are multiple logouts', () => {
    const result = validateDuplicatePunch(['09:00'], ['18:00', '18:30']);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_PUNCH');
    expect(result.detail).toContain('2 logouts');
  });

  it('triggers when both logins and logouts are duplicated', () => {
    const result = validateDuplicatePunch(
      ['09:00', '09:15'],
      ['18:00', '18:30'],
    );

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DUPLICATE_PUNCH');
    expect(result.detail).toContain('2 logins');
    expect(result.detail).toContain('2 logouts');
  });
});
