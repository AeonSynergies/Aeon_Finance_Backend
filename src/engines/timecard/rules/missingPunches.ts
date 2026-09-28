import type { RuleOutcome } from '../types';
import { isBlank } from '../lib/time';
import type { AmazonBreakSegment } from './mealBreak';

export interface MissingPunchInput {
  payLogin: string | null;
  payLogout: string | null;
}

export function validateMissingLogin(input: MissingPunchInput): RuleOutcome {
  const loginBlank = isBlank(input.payLogin);
  const logoutBlank = isBlank(input.payLogout);

  if (loginBlank && logoutBlank) {
    return {
      triggered: true,
      status: 'MISSING_PUNCH',
      detail: 'Both payroll login and logout are missing - no punches recorded',
    };
  }

  if (loginBlank) {
    return {
      triggered: true,
      status: 'MISSING_PAYROLL_LOGIN',
      detail: 'Payroll login is empty',
    };
  }

  return { triggered: false };
}

export function validateMissingLogout(input: MissingPunchInput): RuleOutcome {
  const loginBlank = isBlank(input.payLogin);
  const logoutBlank = isBlank(input.payLogout);

  if (loginBlank && logoutBlank) {
    return { triggered: false };
  }

  if (logoutBlank) {
    return {
      triggered: true,
      status: 'MISSING_PAYROLL_LOGOUT',
      detail: 'Payroll logout is empty',
    };
  }

  return { triggered: false };
}

export interface MissingBreakInput {
  amazonBreaks: AmazonBreakSegment[];
  payBreakOut: string | null;
  payBreakIn: string | null;
}

export function validateMissingBreak(input: MissingBreakInput): RuleOutcome {
  const amazonHasBreak = input.amazonBreaks.length > 0;
  const payrollHasBreak =
    input.payBreakOut !== null &&
    input.payBreakOut.trim() !== '' &&
    input.payBreakIn !== null &&
    input.payBreakIn.trim() !== '';

  if (amazonHasBreak && !payrollHasBreak) {
    return {
      triggered: true,
      status: 'MISSING_MEAL_BREAK',
      detail: 'Amazon shows a meal break but payroll break is missing',
    };
  }
  return { triggered: false };
}
