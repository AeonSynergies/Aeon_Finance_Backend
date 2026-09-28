import {
  matchEmployee,
  namesLikelyMatch,
  type EmployeeMasterRecord,
} from './employeeMatching';

describe('matchEmployee (Rule 1 — Employee Matching)', () => {
  it('matches via DL number when the payroll DL number is on file', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John', dlNumber: 'D1234567' },
    ];
    const result = matchEmployee(
      { payrollName: 'Doe, John', payrollDlNumber: 'D1234567' },
      masterList,
    );

    expect(result.triggered).toBe(false);
    expect(result.method).toBe('DL_NUMBER');
    expect(result.employeeId).toBe('E1');
  });

  it('DL number match is case/whitespace-insensitive', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John', dlNumber: 'D1234567' },
    ];
    const result = matchEmployee(
      { payrollName: 'Doe, John', payrollDlNumber: ' d1234567 ' },
      masterList,
    );

    expect(result.method).toBe('DL_NUMBER');
  });

  it('DL number disambiguates between two employees who would otherwise share a name match', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John', dlNumber: 'D111' },
      { employeeId: 'E2', name: 'Doe, John', configuredAliases: ['Doe, John'] },
    ];
    const result = matchEmployee(
      { payrollName: 'Doe, John', payrollDlNumber: 'D111' },
      masterList,
    );

    expect(result.method).toBe('DL_NUMBER');
    expect(result.employeeId).toBe('E1');
  });

  it('flags Employee Not Matched when two master records share the same DL number', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John', dlNumber: 'D123456' },
      { employeeId: 'E2', name: 'Rivera, Carlos', dlNumber: 'D123456' },
    ];
    const result = matchEmployee(
      { payrollName: 'Rivera, Carlos', payrollDlNumber: 'D123456' },
      masterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
    expect(result.employeeId).toBeNull();
  });

  it('does not flag a false ambiguity when the same employee appears twice in the master list (e.g. a merged file)', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John', dlNumber: 'D123456' },
      { employeeId: 'E1', name: 'Doe, John', dlNumber: 'D123456' },
    ];
    const result = matchEmployee(
      { payrollName: 'Doe, John', payrollDlNumber: 'D123456' },
      masterList,
    );

    expect(result.triggered).toBe(false);
    expect(result.method).toBe('DL_NUMBER');
    expect(result.employeeId).toBe('E1');
  });

  it('does not match on a blank/whitespace-only DL number even if a master record has a blank DL field', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John', dlNumber: '' },
    ];
    const result = matchEmployee(
      { payrollName: 'Totally Different Name', payrollDlNumber: '   ' },
      masterList,
    );

    expect(result.method).not.toBe('DL_NUMBER');
    expect(result.employeeId).not.toBe('E1');
  });

  it('falls through to Configured Matching when no DL number is provided', () => {
    const masterList: EmployeeMasterRecord[] = [
      {
        employeeId: 'E2',
        name: 'Garcia, Maria',
        configuredAliases: ['Maria G'],
      },
    ];
    const result = matchEmployee({ payrollName: 'Maria G' }, masterList);

    expect(result.triggered).toBe(false);
    expect(result.method).toBe('CONFIGURED_MATCHING');
    expect(result.employeeId).toBe('E2');
  });

  it('falls through to Configured Matching when the DL number provided matches no one', () => {
    const masterList: EmployeeMasterRecord[] = [
      {
        employeeId: 'E2',
        name: 'Garcia, Maria',
        dlNumber: 'D999',
        configuredAliases: ['Maria G'],
      },
    ];
    const result = matchEmployee(
      { payrollName: 'Maria G', payrollDlNumber: 'D000-STALE' },
      masterList,
    );

    expect(result.method).toBe('CONFIGURED_MATCHING');
    expect(result.employeeId).toBe('E2');
  });

  it('flags Employee Not Matched when two master records share the same configured alias', () => {
    const masterList: EmployeeMasterRecord[] = [
      {
        employeeId: 'E1',
        name: 'Garcia, Maria',
        configuredAliases: ['Maria G'],
      },
      {
        employeeId: 'E2',
        name: 'Gutierrez, Marco',
        configuredAliases: ['Maria G'],
      },
    ];
    const result = matchEmployee({ payrollName: 'Maria G' }, masterList);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
    expect(result.employeeId).toBeNull();
  });

  it('does not flag a false ambiguity when the same employee appears twice via a shared alias (e.g. a merged file)', () => {
    const masterList: EmployeeMasterRecord[] = [
      {
        employeeId: 'E1',
        name: 'Garcia, Maria',
        configuredAliases: ['Maria G'],
      },
      {
        employeeId: 'E1',
        name: 'Garcia, Maria',
        configuredAliases: ['Maria G'],
      },
    ];
    const result = matchEmployee({ payrollName: 'Maria G' }, masterList);

    expect(result.triggered).toBe(false);
    expect(result.method).toBe('CONFIGURED_MATCHING');
    expect(result.employeeId).toBe('E1');
  });

  it('does not match on a blank/whitespace-only payroll name even if a master record has a blank alias entry', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John', configuredAliases: [''] },
    ];
    const result = matchEmployee({ payrollName: '   ' }, masterList);

    expect(result.method).not.toBe('CONFIGURED_MATCHING');
    expect(result.employeeId).not.toBe('E1');
  });

  it('matches the BRS worked example via name token overlap (payroll has a middle initial Amazon drops)', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E3', name: 'Albarran Bonilla, Alcides' },
    ];
    const result = matchEmployee(
      {
        payrollName: 'Albarran Bonilla, Alcides D',
        amazonName: 'Alcides,Albarran Bonilla',
      },
      masterList,
    );

    expect(result.triggered).toBe(false);
    expect(result.method).toBe('NAME_TOKEN_OVERLAP');
    expect(result.employeeId).toBe('E3');
  });

  it('matches an exact name once normalized, with no middle-name noise', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E4', name: 'Smith, Jane' },
    ];
    const result = matchEmployee({ payrollName: 'Smith, Jane' }, masterList);

    expect(result.method).toBe('NAME_EXACT');
    expect(result.employeeId).toBe('E4');
  });

  it('does not match when the two names do not share every token of the shorter one', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E5', name: 'Yorcal Gonzalez Marte' },
    ];
    const result = matchEmployee(
      { payrollName: 'De Leon Marte, Yorcal Daniel' },
      masterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
  });

  it('does not match two different people who share only a first name', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E6', name: 'Alarcon, Jose' },
    ];
    const result = matchEmployee({ payrollName: 'Martinez, Jose' }, masterList);

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
  });

  it('does not match a bare single-token name via token overlap alone (no corroborating last name)', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E8', name: 'John Smith' },
      { employeeId: 'E9', name: 'John Doe' },
    ];
    const result = matchEmployee({ payrollName: 'John' }, masterList);

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
  });

  it('flags Employee Not Matched for manual review when nothing matches', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E7', name: 'Doe, Jane' },
    ];
    const result = matchEmployee({ payrollName: 'Smith, John' }, masterList);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
    expect(result.employeeId).toBeNull();
    expect(result.detail).toContain('Smith, John');
  });

  it('references the Amazon name in the detail when the payroll-name tier found nothing at all', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, Jane' },
    ];
    const result = matchEmployee(
      { payrollName: 'Smith, John', amazonName: 'Totally,Unrelated' },
      masterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.detail).toContain('Totally,Unrelated');
    expect(result.detail).not.toContain('Smith, John');
  });

  it('references the Amazon name in the "equally strong" detail when the tie came from the Amazon-name fallback', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John' },
      { employeeId: 'E2', name: 'Doe, John' },
    ];
    const result = matchEmployee(
      { payrollName: 'Smith, Totally Different', amazonName: 'John,Doe' },
      masterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.detail).toContain('equally strong');
    expect(result.detail).toContain('John,Doe');
  });

  it('flags Employee Not Matched when the master list is empty', () => {
    const result = matchEmployee({ payrollName: 'Smith, John' }, []);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
  });

  it('does not match a bare single-token name via EXACT string equality alone (no corroborating last name)', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John' },
      { employeeId: 'E2', name: 'Mike' },
    ];
    const result = matchEmployee({ payrollName: 'Mike' }, masterList);

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
  });

  it('picks the strongest match across the whole roster, not just the first candidate that matches', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Martinez, Jose Antonio' },
      { employeeId: 'E2', name: 'Martinez, Jose' },
    ];
    const result = matchEmployee({ payrollName: 'Martinez, Jose' }, masterList);

    expect(result.method).toBe('NAME_EXACT');
    expect(result.employeeId).toBe('E2');
  });

  it('never lets a strong Amazon-name match against the wrong employee outrank a weaker but correct payroll-name match', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Garcia, Maria' },
      { employeeId: 'E2', name: 'Smith, Bob' },
    ];
    const result = matchEmployee(
      { payrollName: 'Garcia, Maria Elena', amazonName: 'Bob,Smith' },
      masterList,
    );

    expect(result.employeeId).toBe('E1');
    expect(result.method).toBe('NAME_TOKEN_OVERLAP');
  });

  it('flags Employee Not Matched when two master records are an equally strong match', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John' },
      { employeeId: 'E2', name: 'Doe, John' },
    ];
    const result = matchEmployee({ payrollName: 'Doe, John' }, masterList);

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
    expect(result.employeeId).toBeNull();
    expect(result.detail).toContain('equally strong');
  });
});

describe('matchEmployee — scored fuzzy fallback (Q1: 75% Amazon, 60% Break Report)', () => {
  it('falls back to a scored 75%+ match against the Amazon list when strict containment finds nothing', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Alvarez Torres, Juan C' },
    ];
    const result = matchEmployee(
      { payrollName: 'Alvarez Torres, Juan Carlos' },
      masterList,
    );

    expect(result.triggered).toBe(false);
    expect(result.method).toBe('FUZZY_AMAZON');
    expect(result.employeeId).toBe('E1');
  });

  it('does not fuzzy-match below the 75% Amazon threshold', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Fernandez, Luis M' },
    ];
    const result = matchEmployee(
      { payrollName: 'Fernandez, Luis Miguel Angel' },
      masterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
  });

  it('falls back further to a scored 60%+ match against the Break Report list when the Amazon list has nothing', () => {
    const breakReportMasterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Fernandez, Luis M' },
    ];
    const result = matchEmployee(
      { payrollName: 'Fernandez, Luis Miguel Angel' },
      [],
      breakReportMasterList,
    );

    expect(result.triggered).toBe(false);
    expect(result.method).toBe('FUZZY_BREAK_REPORT');
    expect(result.employeeId).toBe('E1');
  });

  it('does not fuzzy-match below the 60% Break Report threshold either', () => {
    const breakReportMasterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Totally Different Person' },
    ];
    const result = matchEmployee(
      { payrollName: 'Fernandez, Luis Miguel Angel' },
      [],
      breakReportMasterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
  });

  it('never lets a bare single-token name fuzzy-match via a shared word alone, same 2-word-minimum guard as the strict tier', () => {
    const breakReportMasterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'John Smith' },
    ];
    const result = matchEmployee(
      { payrollName: 'John' },
      [],
      breakReportMasterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
  });

  it('flags Employee Not Matched instead of guessing when two candidates score an equally strong fuzzy match', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Alvarez Torres, Juan C' },
      { employeeId: 'E2', name: 'Alvarez Torres, Juan D' },
    ];
    const result = matchEmployee(
      { payrollName: 'Alvarez Torres, Juan Carlos' },
      masterList,
    );

    expect(result.triggered).toBe(true);
    expect(result.method).toBe('UNMATCHED');
    expect(result.detail).toContain('equally strong');
  });

  it('prefers a strict match over the fuzzy tier when both are available', () => {
    const masterList: EmployeeMasterRecord[] = [
      { employeeId: 'E1', name: 'Doe, John' },
    ];
    const breakReportMasterList: EmployeeMasterRecord[] = [
      { employeeId: 'E2', name: 'Doe, John Extra Words Here' },
    ];
    const result = matchEmployee(
      { payrollName: 'Doe, John' },
      masterList,
      breakReportMasterList,
    );

    expect(result.method).toBe('NAME_EXACT');
    expect(result.employeeId).toBe('E1');
  });
});

describe('namesLikelyMatch (ingestion helper — joining Itinerary and Break Report driver names)', () => {
  it('matches comma-joined vs space-joined formats of the same driver, as in real Itinerary/Break Report data', () => {
    expect(
      namesLikelyMatch('Yackson,Giraldo Damian', 'Yackson Giraldo Damian'),
    ).toBe(true);
  });

  it('matches a real driver whose Break Report name runs two name-parts together with no space', () => {
    expect(
      namesLikelyMatch('Joseph,Munoz Grullon', 'Joseph MunozGrullon'),
    ).toBe(true);
    expect(namesLikelyMatch('Randy,Abreu Polanco', 'Randy AbreuPolanco')).toBe(
      true,
    );
  });

  it('does not match two genuinely different drivers', () => {
    expect(namesLikelyMatch('John,Doe', 'Jane Smith')).toBe(false);
  });
});
