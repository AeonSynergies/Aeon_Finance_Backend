import type { RuleOutcome, TimecardThresholds } from '../types';

const DEFAULT_PTO_EARN_CODES = ['PTO'];
const DEFAULT_BONUS_EARN_CODES = ['BON', 'BNH'];
const DEFAULT_TRAINING_EARN_CODES = ['TRN'];
const DEFAULT_VTO_EARN_CODES = ['VTO'];

function normalizeEarnCode(code: string): string {
  return code.trim().toUpperCase();
}

export function checkEarnCodeShortCircuit(
  earnCode: string | null,
  thresholds: TimecardThresholds = {},
): RuleOutcome {
  if (!earnCode || earnCode.trim() === '') {
    return { triggered: false };
  }

  const normalized = normalizeEarnCode(earnCode);
  const ptoCodes = (thresholds.ptoEarnCodes ?? DEFAULT_PTO_EARN_CODES).map(
    normalizeEarnCode,
  );
  const bonusCodes = (
    thresholds.bonusEarnCodes ?? DEFAULT_BONUS_EARN_CODES
  ).map(normalizeEarnCode);
  const trainingCodes = (
    thresholds.trainingEarnCodes ?? DEFAULT_TRAINING_EARN_CODES
  ).map(normalizeEarnCode);
  const vtoCodes = (thresholds.vtoEarnCodes ?? DEFAULT_VTO_EARN_CODES).map(
    normalizeEarnCode,
  );

  if (ptoCodes.includes(normalized) && bonusCodes.includes(normalized)) {
    return {
      triggered: true,
      status: 'EARN_CODE_MISCONFIGURED',
      detail: `Earn code ${earnCode} is configured as both PTO and Bonus - setup error`,
    };
  }

  if (ptoCodes.includes(normalized)) {
    return {
      triggered: false,
      status: 'PTO',
      detail: `Earn code ${earnCode} is PTO - clock validation skipped`,
    };
  }

  if (bonusCodes.includes(normalized)) {
    return {
      triggered: false,
      status: 'BONUS',
      detail: `Earn code ${earnCode} is Bonus - clock validation skipped`,
    };
  }

  if (trainingCodes.includes(normalized)) {
    return {
      triggered: false,
      status: 'TRAINING',
      detail: `Earn code ${earnCode} is Training - clock validation skipped`,
    };
  }

  if (vtoCodes.includes(normalized)) {
    return {
      triggered: false,
      status: 'VTO',
      detail: `Earn code ${earnCode} is VTO - clock validation skipped`,
    };
  }

  return { triggered: false };
}
