import { validateTimecardRow, type TimecardRowInput } from './sequencer';

function baseRow(overrides: Partial<TimecardRowInput> = {}): TimecardRowInput {
  return {
    payrollName: 'Doe, John',
    payrollDlNumber: null,
    amazonName: null,
    employeeMasterList: [{ employeeId: 'E1', name: 'Doe, John' }],

    payLogin: '09:00',
    payLogout: '18:00',
    payBreakOut: '12:00',
    payBreakIn: '12:30',
    waveStartTime: '09:00',
    appLogin: '09:00',
    appLogout: '18:00',
    physicalLogin: null,
    lastStop: null,
    amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
    deliveryTimestamps: null,

    payLogins: ['09:00'],
    payLogouts: ['18:00'],
    payBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],

    earnCode: 'REG',
    ...overrides,
  };
}

describe('validateTimecardRow (Timecard Validation Sequencer)', () => {
  it('returns GOOD_NO_ERROR when every rule passes cleanly', () => {
    const result = validateTimecardRow(baseRow());

    expect(result.status).toBe('GOOD_NO_ERROR');
    expect(result.triggeredRule).toBeNull();
    expect(result.employeeId).toBe('E1');
    expect(result.ruleResults).toHaveLength(13);
  });

  it('Employee Matching wins outright, even over a genuine login mismatch', () => {
    const result = validateTimecardRow(
      baseRow({
        payrollName: 'Smith, Totally Unmatched',
        employeeMasterList: [{ employeeId: 'E1', name: 'Doe, John' }],
        payLogin: '09:30',
        waveStartTime: '10:30',
      }),
    );

    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
    expect(result.triggeredRule).toBe(1);
    expect(result.employeeId).toBeNull();
    expect(result.ruleResults).toHaveLength(1);
  });

  it('PTO short-circuits and skips Rules 2-11 entirely, even with a genuine login mismatch present', () => {
    const result = validateTimecardRow(
      baseRow({
        earnCode: 'PTO',
        payLogin: '09:30',
        waveStartTime: '10:30',
      }),
    );

    expect(result.status).toBe('PTO');
    expect(result.triggeredRule).toBe(12);
    expect(result.employeeId).toBe('E1');
    expect(result.ruleResults).toHaveLength(2);
  });

  it('PTO short-circuits ahead of Rule 1, so a non-driving PTO day (no Itinerary roster entry that date) is tagged and excluded rather than flagged Employee Not Matched', () => {
    const result = validateTimecardRow(
      baseRow({
        earnCode: 'PTO',
        employeeMasterList: [],
      }),
    );

    expect(result.status).toBe('PTO');
    expect(result.triggeredRule).toBe(12);
    expect(result.employeeId).toBeNull();
  });

  it('Bonus (BON) short-circuits the same way as PTO', () => {
    const result = validateTimecardRow(baseRow({ earnCode: 'BON' }));

    expect(result.status).toBe('BONUS');
    expect(result.triggeredRule).toBe(13);
  });

  it('Training (TRN) short-circuits the same way as PTO/Bonus', () => {
    const result = validateTimecardRow(
      baseRow({
        earnCode: 'TRN',
        payLogin: '09:30',
        waveStartTime: '10:30',
      }),
    );

    expect(result.status).toBe('TRAINING');
    expect(result.triggeredRule).toBe(14);
  });

  it('VTO short-circuits the same way as PTO/Bonus/Training', () => {
    const result = validateTimecardRow(
      baseRow({
        earnCode: 'VTO',
        payLogin: '09:30',
        waveStartTime: '10:30',
      }),
    );

    expect(result.status).toBe('VTO');
    expect(result.triggeredRule).toBe(17);
  });

  it('Q20: a code configured as both PTO and Bonus short-circuits to a setup-error flag, even with a genuine login mismatch present', () => {
    const result = validateTimecardRow(
      baseRow({
        earnCode: 'BON',
        payLogin: '09:30',
        waveStartTime: '10:30',
      }),
      { ptoEarnCodes: ['PTO', 'BON'], bonusEarnCodes: ['BON', 'BNH'] },
    );

    expect(result.status).toBe('EARN_CODE_MISCONFIGURED');
    expect(result.triggeredRule).toBe(15);
  });

  it('Q21: a garbled time value short-circuits ahead of Rules 2-11, even with a genuine login mismatch also present', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: 'N/A',
        waveStartTime: '09:00',
      }),
    );

    expect(result.status).toBe('UNREADABLE_TIME_VALUE');
    expect(result.triggeredRule).toBe(16);
    expect(result.employeeId).toBe('E1');
    expect(result.ruleResults).toHaveLength(2);
  });

  it('Q21: Employee Matching still wins outright over a garbled time value', () => {
    const result = validateTimecardRow(
      baseRow({
        payrollName: 'Smith, Totally Unmatched',
        employeeMasterList: [{ employeeId: 'E1', name: 'Doe, John' }],
        payLogin: 'N/A',
      }),
    );

    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
    expect(result.triggeredRule).toBe(1);
  });

  it('Q21: PTO still short-circuits ahead of a garbled time value, since clock data is irrelevant on a PTO day', () => {
    const result = validateTimecardRow(
      baseRow({
        earnCode: 'PTO',
        payLogin: 'N/A',
      }),
    );

    expect(result.status).toBe('PTO');
    expect(result.triggeredRule).toBe(12);
  });

  it('a Login-tier trigger outranks a Duplicate-Punches-tier trigger per BRS priority order', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: '09:30',
        waveStartTime: '10:30',
        payLogins: ['09:00', '09:15'],
      }),
    );

    expect(result.status).toBe('WAVE_LOGIN_DIFFERENCE');
    expect(result.triggeredRule).toBe(2);
  });

  it('within the Login tier, the lower rule number wins when more than one triggers', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: '09:40',
        waveStartTime: '09:00',
        appLogin: '10:40',
      }),
    );

    expect(result.triggeredRule).toBe(2);
    expect(result.status).toBe('WAVE_LOGIN_DIFFERENCE');
  });

  it('Rule 4 does not fire when Amazon Login is present, even if Physical Timesheet disagrees', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: '09:00',
        appLogin: '09:00',
        physicalLogin: '10:00',
      }),
    );

    expect(result.status).toBe('GOOD_NO_ERROR');
  });

  it('Rule 4 fires and wins the Login tier when Amazon Login is unavailable and Physical Timesheet disagrees', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: '09:00',
        appLogin: null,
        waveStartTime: '09:00',
        physicalLogin: '09:30',
      }),
    );

    expect(result.status).toBe('LOGIN_TIME_DIFFERENCE');
    expect(result.triggeredRule).toBe(4);
  });

  it('an informational status (Amazon Auto Logout Estimated) wins over a plain Good/No Error', () => {
    const result = validateTimecardRow(
      baseRow({
        appLogout: null,
        lastStop: '17:45',
        payLogout: '18:00',
      }),
    );

    expect(result.status).toBe('AMAZON_AUTO_LOGOUT_ESTIMATED');
    expect(result.triggeredRule).toBe(6);
  });

  it('Missing Login (Rule 7) outranks Duplicate Break (Rule 10) per BRS priority order', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: null,
        payBreaks: [
          { breakOut: '11:00', breakIn: '11:15' },
          { breakOut: '15:00', breakIn: '15:15' },
        ],
      }),
    );

    expect(result.status).toBe('MISSING_PAYROLL_LOGIN');
    expect(result.triggeredRule).toBe(7);
  });

  it('within Duplicate Punches, Duplicate Break (10) is primary and Duplicate Punch (11) is reported alongside it when both trigger', () => {
    const result = validateTimecardRow(
      baseRow({
        payBreaks: [
          { breakOut: '11:00', breakIn: '11:15' },
          { breakOut: '15:00', breakIn: '15:15' },
        ],
        payLogins: ['09:00', '09:15'],
      }),
    );

    expect(result.status).toBe('DUPLICATE_BREAK');
    expect(result.triggeredRule).toBe(10);
    expect(result.additionalTriggeredRules).toHaveLength(1);
    expect(result.additionalTriggeredRules[0].rule).toBe(11);
    expect(result.additionalTriggeredRules[0].outcome.status).toBe(
      'DUPLICATE_PUNCH',
    );
  });

  it('within Missing Punches, Missing Logout (8) is primary and Missing Break (9) is reported alongside it when both trigger', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogout: null,
        payBreakOut: null,
        payBreakIn: null,
      }),
    );

    expect(result.status).toBe('MISSING_PAYROLL_LOGOUT');
    expect(result.triggeredRule).toBe(8);
    expect(result.additionalTriggeredRules).toHaveLength(1);
    expect(result.additionalTriggeredRules[0].rule).toBe(9);
    expect(result.additionalTriggeredRules[0].outcome.status).toBe(
      'MISSING_MEAL_BREAK',
    );
  });

  it('Q24: both login and logout missing together reports MISSING_PUNCH as primary (rule 7), and Missing Logout (8) correctly does not also appear as a separate additional finding since it is fully represented by MISSING_PUNCH', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: null,
        payLogout: null,
      }),
    );

    expect(result.status).toBe('MISSING_PUNCH');
    expect(result.triggeredRule).toBe(7);
    expect(result.additionalTriggeredRules).toHaveLength(0);
  });

  it('Q24: MISSING_PUNCH (login+logout both missing) is still reported alongside Missing Break (9) when all three are missing, in ascending rule order', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: null,
        payLogout: null,
        payBreakOut: null,
        payBreakIn: null,
      }),
    );

    expect(result.status).toBe('MISSING_PUNCH');
    expect(result.triggeredRule).toBe(7);
    expect(result.additionalTriggeredRules).toHaveLength(1);
    expect(result.additionalTriggeredRules[0].rule).toBe(9);
  });

  it('additionalTriggeredRules is empty when only one rule in a tie-capable group triggers', () => {
    const result = validateTimecardRow(baseRow({ payLogin: null }));

    expect(result.status).toBe('MISSING_PAYROLL_LOGIN');
    expect(result.additionalTriggeredRules).toEqual([]);
  });

  it('respects configured thresholds passed through to the underlying rules', () => {
    const result = validateTimecardRow(
      baseRow({
        payLogin: '09:12',
        waveStartTime: '09:00',
      }),
      { waveLoginBufferMins: 15 },
    );

    expect(result.status).toBe('GOOD_NO_ERROR');
  });
});
