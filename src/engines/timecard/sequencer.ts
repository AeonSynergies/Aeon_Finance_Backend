import type {
  RuleOutcome,
  TimecardThresholds,
  ValidationStatus,
} from './types';
import {
  matchEmployee,
  type EmployeeMasterRecord,
  type EmployeeMatchMethod,
} from './rules/employeeMatching';
import { validateWaveLogin } from './rules/waveLogin';
import { validateLoginVsAmazon } from './rules/loginVsAmazon';
import { validatePhysicalTimesheet } from './rules/physicalTimesheet';
import { validateMealBreak, type AmazonBreakSegment } from './rules/mealBreak';
import { validateLogout } from './rules/logout';
import {
  validateMissingLogin,
  validateMissingLogout,
  validateMissingBreak,
} from './rules/missingPunches';
import {
  validateDuplicateBreak,
  validateDuplicatePunch,
  type PayBreakSegment,
} from './rules/duplicatePunches';
import { checkEarnCodeShortCircuit } from './rules/earnCodeShortCircuit';
import { checkGarbledTimeValues } from './rules/garbledTimeCheck';

export interface TimecardRowInput {
  payrollName: string;
  payrollDlNumber?: string | null;
  amazonName?: string | null;
  employeeMasterList: EmployeeMasterRecord[];
  breakReportMasterList?: EmployeeMasterRecord[];

  payLogin: string | null;
  payLogout: string | null;
  payBreakOut: string | null;
  payBreakIn: string | null;
  waveStartTime: string | null;
  appLogin: string | null;
  appLogout: string | null;
  physicalLogin: string | null;
  lastStop: string | null;
  amazonBreaks: AmazonBreakSegment[];
  deliveryTimestamps?: string[] | null;
  payLogins: string[];
  payLogouts: string[];
  payBreaks: PayBreakSegment[];

  earnCode: string | null;
  employeeState?: string | null;
  hasSignedMealWaiver?: boolean;
}

export interface RuleResult {
  rule: number;
  outcome: RuleOutcome;
}

export interface TimecardValidationResult {
  employeeId: string | null;
  employeeMatchMethod: EmployeeMatchMethod;
  status: ValidationStatus;
  detail?: string;
  triggeredRule: number | null;
  additionalTriggeredRules: RuleResult[];
  ruleResults: RuleResult[];
}

const PRIORITY_GROUPS: number[][] = [[2, 3, 4], [6], [5], [7, 8, 9], [10, 11]];

export function validateTimecardRow(
  input: TimecardRowInput,
  thresholds: TimecardThresholds = {},
): TimecardValidationResult {
  const earnCodeResult = checkEarnCodeShortCircuit(input.earnCode, thresholds);

  const rule1 = matchEmployee(
    {
      payrollName: input.payrollName,
      payrollDlNumber: input.payrollDlNumber,
      amazonName: input.amazonName,
    },
    input.employeeMasterList,
    input.breakReportMasterList ?? [],
    thresholds,
  );

  const EARN_CODE_SHORT_CIRCUIT_RULES: Partial<
    Record<ValidationStatus, number>
  > = {
    PTO: 12,
    BONUS: 13,
    TRAINING: 14,
    EARN_CODE_MISCONFIGURED: 15,
    VTO: 17,
  };

  if (
    earnCodeResult.status !== undefined &&
    earnCodeResult.status in EARN_CODE_SHORT_CIRCUIT_RULES
  ) {
    const earnCodeRule = EARN_CODE_SHORT_CIRCUIT_RULES[earnCodeResult.status]!;
    return {
      employeeId: rule1.employeeId,
      employeeMatchMethod: rule1.method,
      status: earnCodeResult.status,
      detail: earnCodeResult.detail,
      triggeredRule: earnCodeRule,
      additionalTriggeredRules: [],
      ruleResults: [
        { rule: 1, outcome: rule1 },
        { rule: earnCodeRule, outcome: earnCodeResult },
      ],
    };
  }

  if (rule1.triggered) {
    return {
      employeeId: null,
      employeeMatchMethod: rule1.method,
      status: rule1.status!,
      detail: rule1.detail,
      triggeredRule: 1,
      additionalTriggeredRules: [],
      ruleResults: [{ rule: 1, outcome: rule1 }],
    };
  }

  const garbledCheck = checkGarbledTimeValues({
    payLogin: input.payLogin,
    payLogout: input.payLogout,
    payBreakOut: input.payBreakOut,
    payBreakIn: input.payBreakIn,
    waveStartTime: input.waveStartTime,
    appLogin: input.appLogin,
    appLogout: input.appLogout,
    physicalLogin: input.physicalLogin,
    lastStop: input.lastStop,
  });

  if (garbledCheck.triggered) {
    return {
      employeeId: rule1.employeeId,
      employeeMatchMethod: rule1.method,
      status: garbledCheck.status!,
      detail: garbledCheck.detail,
      triggeredRule: 16,
      additionalTriggeredRules: [],
      ruleResults: [
        { rule: 1, outcome: rule1 },
        { rule: 16, outcome: garbledCheck },
      ],
    };
  }

  const rule2 = validateWaveLogin(
    { payLogin: input.payLogin, waveStartTime: input.waveStartTime },
    thresholds,
  );
  const rule3 = validateLoginVsAmazon(
    { payLogin: input.payLogin, appLogin: input.appLogin },
    thresholds,
  );
  const rule4 = validatePhysicalTimesheet(
    {
      payLogin: input.payLogin,
      physicalLogin: input.physicalLogin,
      appLogin: input.appLogin,
    },
    thresholds,
  );
  const rule5 = validateMealBreak(
    {
      amazonBreaks: input.amazonBreaks,
      payBreakOut: input.payBreakOut,
      payBreakIn: input.payBreakIn,
      deliveryTimestamps: input.deliveryTimestamps,
    },
    thresholds,
  );
  const rule6 = validateLogout(
    {
      payLogout: input.payLogout,
      appLogout: input.appLogout,
      lastStop: input.lastStop,
    },
    thresholds,
  );
  const missingPunchInput = {
    payLogin: input.payLogin,
    payLogout: input.payLogout,
  };
  const rule7 = validateMissingLogin(missingPunchInput);
  const rule8 = validateMissingLogout(missingPunchInput);
  const rule9 = validateMissingBreak({
    amazonBreaks: input.amazonBreaks,
    payBreakOut: input.payBreakOut,
    payBreakIn: input.payBreakIn,
  });
  const rule10 = validateDuplicateBreak(
    input.payBreaks,
    {
      employeeState: input.employeeState,
      hasSignedMealWaiver: input.hasSignedMealWaiver,
    },
    thresholds,
  );
  const rule11 = validateDuplicatePunch(input.payLogins, input.payLogouts);

  const ruleResults: RuleResult[] = [
    { rule: 1, outcome: rule1 },
    { rule: 2, outcome: rule2 },
    { rule: 3, outcome: rule3 },
    { rule: 4, outcome: rule4 },
    { rule: 5, outcome: rule5 },
    { rule: 6, outcome: rule6 },
    { rule: 7, outcome: rule7 },
    { rule: 8, outcome: rule8 },
    { rule: 9, outcome: rule9 },
    { rule: 10, outcome: rule10 },
    { rule: 11, outcome: rule11 },
    { rule: 12, outcome: earnCodeResult },
    { rule: 16, outcome: garbledCheck },
  ];

  const byRule = new Map(ruleResults.map((r) => [r.rule, r.outcome]));

  for (const group of PRIORITY_GROUPS) {
    const triggeredInGroup = group
      .map((ruleNum) => ({ rule: ruleNum, outcome: byRule.get(ruleNum)! }))
      .filter((r) => r.outcome?.triggered);

    if (triggeredInGroup.length > 0) {
      const [primary, ...additionalTriggeredRules] = triggeredInGroup;
      return {
        employeeId: rule1.employeeId,
        employeeMatchMethod: rule1.method,
        status: primary.outcome.status!,
        detail: primary.outcome.detail,
        triggeredRule: primary.rule,
        additionalTriggeredRules,
        ruleResults,
      };
    }
  }

  for (const group of PRIORITY_GROUPS) {
    for (const ruleNum of group) {
      const outcome = byRule.get(ruleNum);
      if (!outcome?.triggered && outcome?.status) {
        return {
          employeeId: rule1.employeeId,
          employeeMatchMethod: rule1.method,
          status: outcome.status,
          detail: outcome.detail,
          triggeredRule: ruleNum,
          additionalTriggeredRules: [],
          ruleResults,
        };
      }
    }
  }

  return {
    employeeId: rule1.employeeId,
    employeeMatchMethod: rule1.method,
    status: 'GOOD_NO_ERROR',
    triggeredRule: null,
    additionalTriggeredRules: [],
    ruleResults,
  };
}
