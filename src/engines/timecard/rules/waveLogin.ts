import type { RuleOutcome, TimecardThresholds } from '../types';
import { minutesDiff } from '../lib/time';

export interface WaveLoginInput {
  payLogin: string | null;
  waveStartTime: string | null;
}

const DEFAULT_WAVE_LOGIN_BUFFER_MINS = 5;

export function validateWaveLogin(
  input: WaveLoginInput,
  thresholds: TimecardThresholds = {},
): RuleOutcome {
  const buffer =
    thresholds.waveLoginBufferMins ?? DEFAULT_WAVE_LOGIN_BUFFER_MINS;
  const diff = minutesDiff(input.payLogin, input.waveStartTime);

  if (diff === null || diff <= buffer) {
    return { triggered: false };
  }

  return {
    triggered: true,
    status: 'WAVE_LOGIN_DIFFERENCE',
    detail: `Payroll login differs from assigned wave start (${input.waveStartTime}) by ${diff}m, exceeding the ${buffer}m buffer`,
  };
}
