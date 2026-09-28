import type { RuleOutcome, TimecardThresholds } from '../types';
import { minutesDiff, parseTimeToMinutes } from '../lib/time';

export interface LogoutInput {
  payLogout: string | null;
  appLogout: string | null;
  lastStop: string | null;
}

const DEFAULT_LOGOUT_BUFFER_MINS = 15;
const DEFAULT_AMAZON_AUTO_LOGOUT_ESTIMATE_BUFFER_MINS = 30;

export function validateLogout(
  input: LogoutInput,
  thresholds: TimecardThresholds = {},
): RuleOutcome {
  const buffer = thresholds.logoutBufferMins ?? DEFAULT_LOGOUT_BUFFER_MINS;
  const estimateBuffer =
    thresholds.amazonAutoLogoutEstimateBufferMins ??
    DEFAULT_AMAZON_AUTO_LOGOUT_ESTIMATE_BUFFER_MINS;

  const hasAppLogout =
    input.appLogout !== null && input.appLogout.trim() !== '';

  if (hasAppLogout) {
    const diff = minutesDiff(input.payLogout, input.appLogout);
    if (diff === null || diff <= buffer) {
      return { triggered: false };
    }
    return {
      triggered: true,
      status: 'LOGOUT_TIME_DIFFERENCE',
      detail: `Payroll logout differs from Amazon logout (${input.appLogout}) by ${diff}m, exceeding the ${buffer}m buffer`,
    };
  }

  const hasLastStop = input.lastStop !== null && input.lastStop.trim() !== '';
  if (!hasLastStop) {
    return {
      triggered: true,
      status: 'COMPARISON_DATA_MISSING',
      detail:
        'Both Amazon logout and last delivery stop are missing - flagged for manual review',
    };
  }

  const lastStopMins = parseTimeToMinutes(input.lastStop);
  const payLogoutMins = parseTimeToMinutes(input.payLogout);
  if (lastStopMins === null || payLogoutMins === null) {
    return { triggered: false };
  }

  const estimatedLogoutMins = lastStopMins + estimateBuffer;
  const diff = Math.abs(payLogoutMins - estimatedLogoutMins);

  if (diff <= buffer) {
    return {
      triggered: false,
      status: 'AMAZON_AUTO_LOGOUT_ESTIMATED',
      detail: `Amazon logout missing; estimated from last stop (${input.lastStop}) + ${estimateBuffer}m buffer. Payroll logout matches the estimate`,
    };
  }

  return {
    triggered: true,
    status: 'LOGOUT_TIME_DIFFERENCE',
    detail: `Amazon logout missing; estimated from last stop (${input.lastStop}) + ${estimateBuffer}m buffer. Payroll logout differs from that estimate by ${diff}m`,
  };
}
