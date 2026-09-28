import type { RuleOutcome } from '../types';
import { isBlank, parseTimeToMinutes } from '../lib/time';

export interface GarbledTimeCheckInput {
  payLogin: string | null;
  payLogout: string | null;
  payBreakOut: string | null;
  payBreakIn: string | null;
  waveStartTime: string | null;
  appLogin: string | null;
  appLogout: string | null;
  physicalLogin: string | null;
  lastStop: string | null;
}

const CHECKED_FIELDS: (keyof GarbledTimeCheckInput)[] = [
  'payLogin',
  'payLogout',
  'payBreakOut',
  'payBreakIn',
  'waveStartTime',
  'appLogin',
  'appLogout',
  'physicalLogin',
  'lastStop',
];

export function checkGarbledTimeValues(
  input: GarbledTimeCheckInput,
): RuleOutcome {
  for (const field of CHECKED_FIELDS) {
    const value = input[field];
    if (!isBlank(value) && parseTimeToMinutes(value) === null) {
      return {
        triggered: true,
        status: 'UNREADABLE_TIME_VALUE',
        detail: `${field} value "${value}" is unreadable/garbled - flagged for manual review`,
      };
    }
  }

  return { triggered: false };
}
