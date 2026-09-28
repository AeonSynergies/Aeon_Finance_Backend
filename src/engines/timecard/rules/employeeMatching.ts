import type { RuleOutcome, TimecardThresholds } from '../types';

export interface EmployeeMasterRecord {
  employeeId: string;
  name: string;
  dlNumber?: string | null;
  configuredAliases?: string[];
}

export interface EmployeeMatchInput {
  payrollName: string;
  payrollDlNumber?: string | null;
  amazonName?: string | null;
}

export type EmployeeMatchMethod =
  | 'DL_NUMBER'
  | 'CONFIGURED_MATCHING'
  | 'NAME_EXACT'
  | 'NAME_TOKEN_OVERLAP'
  | 'FUZZY_AMAZON'
  | 'FUZZY_BREAK_REPORT'
  | 'UNMATCHED';

const DEFAULT_FUZZY_AMAZON_THRESHOLD = 0.75;
const DEFAULT_FUZZY_BREAK_REPORT_THRESHOLD = 0.6;

export interface EmployeeMatchResult extends RuleOutcome {
  employeeId: string | null;
  method: EmployeeMatchMethod;
}

function normalizePayrollName(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
  const lastname = trimmed.slice(0, commaIdx).trim();
  const firstname = trimmed.slice(commaIdx + 1).trim();
  return `${firstname} ${lastname}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeAmazonName(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
  const firstname = trimmed.slice(0, commaIdx).trim();
  const lastname = trimmed.slice(commaIdx + 1).trim();
  return `${firstname} ${lastname}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

type NameCompareMethod = 'EXACT' | 'TOKEN_OVERLAP' | 'NO_MATCH';

function compareNames(
  normalizedA: string,
  normalizedB: string,
): NameCompareMethod {
  if (!normalizedA || !normalizedB) return 'NO_MATCH';

  const tokensA = new Set(normalizedA.split(' ').filter(Boolean));
  const tokensB = new Set(normalizedB.split(' ').filter(Boolean));
  const smaller = tokensA.size <= tokensB.size ? tokensA : tokensB;
  const larger = tokensA.size <= tokensB.size ? tokensB : tokensA;

  if (smaller.size < 2) return 'NO_MATCH';

  for (const token of smaller) {
    if (!larger.has(token)) return 'NO_MATCH';
  }

  return smaller.size === larger.size ? 'EXACT' : 'TOKEN_OVERLAP';
}

function toEmployeeMatchMethod(
  nameMethod: Exclude<NameCompareMethod, 'NO_MATCH'>,
): EmployeeMatchMethod {
  switch (nameMethod) {
    case 'EXACT':
      return 'NAME_EXACT';
    case 'TOKEN_OVERLAP':
      return 'NAME_TOKEN_OVERLAP';
  }
}

const NAME_METHOD_RANK: Record<
  Exclude<NameCompareMethod, 'NO_MATCH'>,
  number
> = {
  EXACT: 2,
  TOKEN_OVERLAP: 1,
};

interface BestMatch {
  employeeId: string;
  method: Exclude<NameCompareMethod, 'NO_MATCH'>;
}

function findBestMatch(
  candidates: { employeeId: string; normalizedMaster: string }[],
  target: string,
): { best: BestMatch | null; tied: boolean } {
  let best: BestMatch | null = null;
  let tied = false;

  for (const { employeeId, normalizedMaster } of candidates) {
    const method = compareNames(target, normalizedMaster);
    if (method === 'NO_MATCH') continue;

    if (best === null) {
      best = { employeeId, method };
      tied = false;
    } else if (NAME_METHOD_RANK[method] > NAME_METHOD_RANK[best.method]) {
      best = { employeeId, method };
      tied = false;
    } else if (
      NAME_METHOD_RANK[method] === NAME_METHOD_RANK[best.method] &&
      employeeId !== best.employeeId
    ) {
      tied = true;
    }
  }

  return { best, tied };
}

function tokenOverlapScore(normalizedA: string, normalizedB: string): number {
  const tokensA = new Set(normalizedA.split(' ').filter(Boolean));
  const tokensB = new Set(normalizedB.split(' ').filter(Boolean));
  if (tokensA.size < 2 || tokensB.size < 2) return 0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionSize++;
  }
  return intersectionSize / Math.min(tokensA.size, tokensB.size);
}

interface BestScoredMatch {
  employeeId: string;
  score: number;
}

function findBestScoredMatch(
  candidates: { employeeId: string; normalizedMaster: string }[],
  target: string,
  threshold: number,
): { best: BestScoredMatch | null; tied: boolean } {
  let best: BestScoredMatch | null = null;
  let tied = false;

  for (const { employeeId, normalizedMaster } of candidates) {
    const score = tokenOverlapScore(target, normalizedMaster);
    if (score < threshold) continue;

    if (best === null || score > best.score) {
      best = { employeeId, score };
      tied = false;
    } else if (score === best.score && employeeId !== best.employeeId) {
      tied = true;
    }
  }

  return { best, tied };
}

export function namesLikelyMatch(nameA: string, nameB: string): boolean {
  const normalize = (raw: string) =>
    raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const a = normalize(nameA);
  const b = normalize(nameB);
  if (compareNames(a, b) !== 'NO_MATCH') return true;
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
}

export function matchEmployee(
  input: EmployeeMatchInput,
  masterList: EmployeeMasterRecord[],
  fallbackMasterList: EmployeeMasterRecord[] = [],
  thresholds: TimecardThresholds = {},
): EmployeeMatchResult {
  if (input.payrollDlNumber && input.payrollDlNumber.trim() !== '') {
    const dlLower = input.payrollDlNumber.trim().toLowerCase();
    const dlMatches = masterList.filter(
      (e) => e.dlNumber?.trim().toLowerCase() === dlLower,
    );
    const dlEmployeeIds = new Set(dlMatches.map((e) => e.employeeId));
    if (dlEmployeeIds.size === 1) {
      return {
        triggered: false,
        employeeId: dlMatches[0].employeeId,
        method: 'DL_NUMBER',
      };
    }
    if (dlEmployeeIds.size > 1) {
      return {
        triggered: true,
        employeeId: null,
        method: 'UNMATCHED',
        status: 'EMPLOYEE_NOT_MATCHED',
        detail: `Multiple Employee Master records share DL number "${input.payrollDlNumber}" - cannot safely pick one`,
      };
    }
  }

  const rawPayrollLower = input.payrollName.trim().toLowerCase();
  if (rawPayrollLower !== '') {
    const aliasMatches = masterList.filter((e) =>
      (e.configuredAliases ?? []).some(
        (alias) => alias.trim().toLowerCase() === rawPayrollLower,
      ),
    );
    const aliasEmployeeIds = new Set(aliasMatches.map((e) => e.employeeId));
    if (aliasEmployeeIds.size === 1) {
      return {
        triggered: false,
        employeeId: aliasMatches[0].employeeId,
        method: 'CONFIGURED_MATCHING',
      };
    }
    if (aliasEmployeeIds.size > 1) {
      return {
        triggered: true,
        employeeId: null,
        method: 'UNMATCHED',
        status: 'EMPLOYEE_NOT_MATCHED',
        detail: `Multiple Employee Master records share the configured alias for payroll name "${input.payrollName}" - cannot safely pick one`,
      };
    }
  }

  const normalizedPayroll = normalizePayrollName(input.payrollName);
  const normalizedAmazon = input.amazonName
    ? normalizeAmazonName(input.amazonName)
    : null;

  const candidates = masterList.map((employee) => ({
    employeeId: employee.employeeId,
    normalizedMaster: normalizePayrollName(employee.name),
  }));

  const payrollResult = findBestMatch(candidates, normalizedPayroll);
  const comparedAmazon = !payrollResult.best && normalizedAmazon !== null;
  const result = payrollResult.best
    ? payrollResult
    : normalizedAmazon
      ? findBestMatch(candidates, normalizedAmazon)
      : { best: null, tied: false };

  if (result.best && !result.tied) {
    return {
      triggered: false,
      employeeId: result.best.employeeId,
      method: toEmployeeMatchMethod(result.best.method),
    };
  }

  let anyTied = result.tied;

  if (!result.tied) {
    const amazonThreshold =
      thresholds.fuzzyAmazonMatchThreshold ?? DEFAULT_FUZZY_AMAZON_THRESHOLD;
    const scoredAmazon = findBestScoredMatch(
      candidates,
      normalizedPayroll,
      amazonThreshold,
    );
    if (scoredAmazon.best && !scoredAmazon.tied) {
      return {
        triggered: false,
        employeeId: scoredAmazon.best.employeeId,
        method: 'FUZZY_AMAZON',
      };
    }
    anyTied = scoredAmazon.tied;

    if (!scoredAmazon.tied && fallbackMasterList.length > 0) {
      const breakReportThreshold =
        thresholds.fuzzyBreakReportMatchThreshold ??
        DEFAULT_FUZZY_BREAK_REPORT_THRESHOLD;
      const fallbackCandidates = fallbackMasterList.map((employee) => ({
        employeeId: employee.employeeId,
        normalizedMaster: normalizePayrollName(employee.name),
      }));
      const scoredBreakReport = findBestScoredMatch(
        fallbackCandidates,
        normalizedPayroll,
        breakReportThreshold,
      );
      if (scoredBreakReport.best && !scoredBreakReport.tied) {
        return {
          triggered: false,
          employeeId: scoredBreakReport.best.employeeId,
          method: 'FUZZY_BREAK_REPORT',
        };
      }
      anyTied = scoredBreakReport.tied;
    }
  }

  const compareSource = comparedAmazon
    ? `Amazon name "${input.amazonName}"`
    : `payroll name "${input.payrollName}"`;

  return {
    triggered: true,
    employeeId: null,
    method: 'UNMATCHED',
    status: 'EMPLOYEE_NOT_MATCHED',
    detail: anyTied
      ? `Multiple Employee Master records are an equally strong name match for ${compareSource} - cannot safely pick one`
      : `No Employee Master match for ${compareSource}`,
  };
}
