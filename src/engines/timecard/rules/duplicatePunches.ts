import type { RuleOutcome, TimecardThresholds } from '../types';

export interface PayBreakSegment {
  breakOut: string;
  breakIn: string;
}

export interface MealWaiverContext {
  employeeState?: string | null;
  hasSignedMealWaiver?: boolean;
}

const DEFAULT_MEAL_WAIVER_EXEMPT_STATES = ['CA', 'TX'];

export function validateDuplicateBreak(
  payBreaks: PayBreakSegment[],
  waiver: MealWaiverContext = {},
  thresholds: TimecardThresholds = {},
): RuleOutcome {
  if (
    payBreaks.length === 2 &&
    waiver.hasSignedMealWaiver &&
    waiver.employeeState
  ) {
    const exemptStates = (
      thresholds.mealWaiverExemptStates ?? DEFAULT_MEAL_WAIVER_EXEMPT_STATES
    ).map((state) => state.trim().toUpperCase());
    const normalizedState = waiver.employeeState.trim().toUpperCase();

    if (exemptStates.includes(normalizedState)) {
      return {
        triggered: false,
        status: 'MEAL_WAIVER_EXEMPT',
        detail: `Second meal break exempt via signed waiver (${normalizedState})`,
      };
    }
  }

  if (payBreaks.length >= 2) {
    return {
      triggered: true,
      status: 'DUPLICATE_BREAK',
      detail: `Payroll contains ${payBreaks.length} meal breaks for this day - manual review required`,
    };
  }
  return { triggered: false };
}

export function validateDuplicatePunch(
  payLogins: string[],
  payLogouts: string[],
): RuleOutcome {
  const duplicateLogins = payLogins.length >= 2;
  const duplicateLogouts = payLogouts.length >= 2;

  if (duplicateLogins && duplicateLogouts) {
    return {
      triggered: true,
      status: 'DUPLICATE_PUNCH',
      detail: `Payroll contains ${payLogins.length} logins and ${payLogouts.length} logouts for this day - manual review required`,
    };
  }

  if (duplicateLogins) {
    return {
      triggered: true,
      status: 'DUPLICATE_PUNCH',
      detail: `Payroll contains ${payLogins.length} logins for this day - manual review required`,
    };
  }

  if (duplicateLogouts) {
    return {
      triggered: true,
      status: 'DUPLICATE_PUNCH',
      detail: `Payroll contains ${payLogouts.length} logouts for this day - manual review required`,
    };
  }

  return { triggered: false };
}
