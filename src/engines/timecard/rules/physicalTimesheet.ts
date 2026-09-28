import type { RuleOutcome, TimecardThresholds } from '../types';
import { minutesDiff } from '../lib/time';

export interface PhysicalTimesheetInput {
  payLogin: string | null;
  physicalLogin: string | null;
  appLogin: string | null;
}

const DEFAULT_PHYSICAL_LOGIN_BUFFER_MINS = 5;

// UNCONFIRMED ASSUMPTION
// TIMECARD_LOGIC.txt never states whether Rule 4 produces its own
// validation status, or what that status would be called. Built on three
// disclosed, unconfirmed choices:
// (a) this rule only fires when Amazon Login is unavailable for the row --
//     when Amazon Login is present, "Amazon always overrides Physical
//     Sheet" and this rule produces no flag at all, regardless of any
//     Payroll/Physical mismatch;
// (b) reuses LOGIN_TIME_DIFFERENCE as the status, since no distinct status
//     exists anywhere in Section 8 for a Physical Timesheet comparison;
// (c) "Amazon Login unavailable" means null OR empty/whitespace-only,
//     matching this engine's established convention elsewhere (Rules 5/6/9
//     etc.), not something TIMECARD_LOGIC.txt states for this rule
//     specifically.
export function validatePhysicalTimesheet(
  input: PhysicalTimesheetInput,
  thresholds: TimecardThresholds = {},
): RuleOutcome {
  if (input.physicalLogin === null || input.physicalLogin.trim() === '') {
    return { triggered: false };
  }

  if (input.appLogin !== null && input.appLogin.trim() !== '') {
    return { triggered: false };
  }

  const buffer =
    thresholds.physicalLoginBufferMins ?? DEFAULT_PHYSICAL_LOGIN_BUFFER_MINS;
  const diff = minutesDiff(input.payLogin, input.physicalLogin);

  if (diff === null || diff <= buffer) {
    return { triggered: false };
  }

  return {
    triggered: true,
    status: 'LOGIN_TIME_DIFFERENCE',
    detail: `Payroll login differs from Physical Timesheet login (${input.physicalLogin}) by ${diff}m, exceeding the ${buffer}m buffer; Amazon Login unavailable to arbitrate`,
  };
}
