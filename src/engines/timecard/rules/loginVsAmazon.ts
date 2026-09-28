import type { RuleOutcome, TimecardThresholds } from '../types';
import { isBlank, minutesDiff } from '../lib/time';

export interface LoginVsAmazonInput {
  payLogin: string | null;
  appLogin: string | null;
}

const DEFAULT_AMAZON_LOGIN_BUFFER_MINS = 30;

export function validateLoginVsAmazon(
  input: LoginVsAmazonInput,
  thresholds: TimecardThresholds = {},
): RuleOutcome {
  const buffer =
    thresholds.amazonLoginBufferMins ?? DEFAULT_AMAZON_LOGIN_BUFFER_MINS;
  const diff = minutesDiff(input.payLogin, input.appLogin);

  if (diff === null) {
    if (isBlank(input.payLogin) && isBlank(input.appLogin)) {
      return {
        triggered: true,
        status: 'COMPARISON_DATA_MISSING',
        detail:
          'Both payroll login and Amazon login are missing - flagged for manual review',
      };
    }
    return { triggered: false };
  }

  if (diff <= buffer) {
    return { triggered: false };
  }

  return {
    triggered: true,
    status: 'LOGIN_TIME_DIFFERENCE',
    detail: `Payroll login differs from Amazon login (${input.appLogin}) by ${diff}m, exceeding the ${buffer}m buffer`,
  };
}
