export type ValidationStatus =
  | 'GOOD_NO_ERROR'
  | 'NEED_MANUAL_VALIDATION'
  | 'PENDING_DRIVER_CORRECTION'
  | 'PENDING_MANAGER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'MISSING_PAYROLL_LOGIN'
  | 'LOGIN_TIME_DIFFERENCE'
  | 'WAVE_LOGIN_DIFFERENCE'
  | 'EMPLOYEE_NOT_MATCHED'
  | 'MISSING_PAYROLL_LOGOUT'
  | 'LOGOUT_TIME_DIFFERENCE'
  | 'AMAZON_AUTO_LOGOUT_ESTIMATED'
  | 'MISSING_MEAL_BREAK'
  | 'BREAK_TIME_DIFFERENCE'
  | 'BREAK_DURATION_DIFFERENCE'
  | 'DUPLICATE_BREAK'
  | 'MEAL_WAIVER_EXEMPT'
  | 'DELIVERY_DURING_BREAK'
  | 'DUPLICATE_PUNCH'
  | 'MISSING_PUNCH'
  | 'PTO'
  | 'BONUS'
  | 'TRAINING'
  | 'COMPARISON_DATA_MISSING'
  | 'EARN_CODE_MISCONFIGURED'
  | 'UNREADABLE_TIME_VALUE'
  | 'VTO';

export interface RuleOutcome {
  triggered: boolean;
  status?: ValidationStatus;
  detail?: string;
}

export interface TimecardThresholds {
  waveLoginBufferMins?: number;
  amazonLoginBufferMins?: number;
  mealBreakBufferMins?: number;
  logoutBufferMins?: number;
  physicalLoginBufferMins?: number;
  ptoEarnCodes?: string[];
  bonusEarnCodes?: string[];
  trainingEarnCodes?: string[];
  vtoEarnCodes?: string[];
  fuzzyAmazonMatchThreshold?: number;
  fuzzyBreakReportMatchThreshold?: number;
  mealWaiverExemptStates?: string[];
  amazonAutoLogoutEstimateBufferMins?: number;
}
