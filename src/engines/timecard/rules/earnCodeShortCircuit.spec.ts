import { checkEarnCodeShortCircuit } from './earnCodeShortCircuit';

describe('checkEarnCodeShortCircuit (Rules 12/13/14 — PTO/Bonus/Training earn code)', () => {
  it('tags PTO and does not treat it as an issue', () => {
    const result = checkEarnCodeShortCircuit('PTO');

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('PTO');
  });

  it('is case-insensitive for PTO', () => {
    const result = checkEarnCodeShortCircuit('pto');

    expect(result.status).toBe('PTO');
  });

  it('tags BON as Bonus', () => {
    const result = checkEarnCodeShortCircuit('BON');

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('BONUS');
  });

  it('tags BNH as Bonus', () => {
    const result = checkEarnCodeShortCircuit('BNH');

    expect(result.status).toBe('BONUS');
  });

  it('tags TRN as Training', () => {
    const result = checkEarnCodeShortCircuit('TRN');

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('TRAINING');
  });

  it('is case-insensitive for Training', () => {
    const result = checkEarnCodeShortCircuit('trn');

    expect(result.status).toBe('TRAINING');
  });

  it('respects a configured Training earn code list from Settings', () => {
    const result = checkEarnCodeShortCircuit('TRAINING', {
      trainingEarnCodes: ['TRAINING'],
    });

    expect(result.status).toBe('TRAINING');
  });

  it('does not tag a normal earn code like REG', () => {
    const result = checkEarnCodeShortCircuit('REG');

    expect(result.triggered).toBe(false);
    expect(result.status).toBeUndefined();
  });

  it('does not tag when earn code is missing', () => {
    const result = checkEarnCodeShortCircuit(null);

    expect(result.triggered).toBe(false);
    expect(result.status).toBeUndefined();
  });

  it('tags VTO and does not treat it as an issue', () => {
    const result = checkEarnCodeShortCircuit('VTO');

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('VTO');
  });

  it('is case-insensitive for VTO', () => {
    const result = checkEarnCodeShortCircuit('vto');

    expect(result.status).toBe('VTO');
  });

  it('respects a configured VTO earn code list from Settings', () => {
    const result = checkEarnCodeShortCircuit('VOLUNTARY', {
      vtoEarnCodes: ['VOLUNTARY'],
    });

    expect(result.status).toBe('VTO');
  });

  it('respects configured PTO/Bonus earn code lists from Settings', () => {
    const result = checkEarnCodeShortCircuit('SICK', {
      ptoEarnCodes: ['PTO', 'SICK'],
    });

    expect(result.status).toBe('PTO');
  });

  it('Q20: flags a setup error when the same code is configured as both PTO and Bonus, instead of silently picking PTO', () => {
    const result = checkEarnCodeShortCircuit('BON', {
      ptoEarnCodes: ['PTO', 'BON'],
      bonusEarnCodes: ['BON', 'BNH'],
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('EARN_CODE_MISCONFIGURED');
    expect(result.detail).toContain('BON');
  });

  it('does not falsely flag a misconfiguration when the code is only in one list', () => {
    const result = checkEarnCodeShortCircuit('PTO', {
      ptoEarnCodes: ['PTO'],
      bonusEarnCodes: ['BON', 'BNH'],
    });

    expect(result.triggered).toBe(false);
    expect(result.status).toBe('PTO');
  });
});
