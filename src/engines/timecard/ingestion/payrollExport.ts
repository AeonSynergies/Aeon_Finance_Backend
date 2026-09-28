import { Workbook } from 'exceljs';
import {
  convertTo24Hour,
  normalizeDateToIso,
  normalizeName,
} from './timeFormat';
import { parseTimeToMinutes } from '../lib/time';
import {
  buildHeaderIndex,
  cellToDateValue,
  cellToString,
  cellToTimeString,
  headerColumn,
} from './workbookHelpers';

export interface PayrollExportRow {
  payrollName: string;
  payDate: string | Date;
  timeIn: string | null;
  timeOut: string | null;
  earnCode: string | null;
}

export interface PayBreakSegment {
  breakOut: string;
  breakIn: string;
}

export interface GroupedPayrollDay {
  payrollName: string;
  payDate: string;
  payLogin: string | null;
  payLogout: string | null;
  payLogins: string[];
  payLogouts: string[];
  payBreaks: PayBreakSegment[];
  payBreakOut: string | null;
  payBreakIn: string | null;
  earnCode: string | null;
}

interface NormalizedRow {
  payrollName: string;
  payDate: string;
  timeIn: string | null;
  timeOut: string | null;
  earnCode: string | null;
}

export function groupPayrollExport(
  rows: PayrollExportRow[],
): GroupedPayrollDay[] {
  const groups = new Map<string, NormalizedRow[]>();

  for (const row of rows) {
    const payrollName = normalizeName(row.payrollName);
    const payDate = normalizeDateToIso(row.payDate);
    if (payrollName === null || payDate === null) continue;

    const key = payrollName + '|' + payDate;
    const normalized: NormalizedRow = {
      payrollName,
      payDate,
      timeIn: convertTo24Hour(row.timeIn),
      timeOut: convertTo24Hour(row.timeOut),
      earnCode: normalizeName(row.earnCode) ?? 'REG',
    };

    const existing = groups.get(key);
    if (existing) existing.push(normalized);
    else groups.set(key, [normalized]);
  }

  const result: GroupedPayrollDay[] = [];

  for (const groupRows of groups.values()) {
    const sorted = [...groupRows].sort((a, b) => {
      const minsA = parseTimeToMinutes(a.timeIn) ?? Number.POSITIVE_INFINITY;
      const minsB = parseTimeToMinutes(b.timeIn) ?? Number.POSITIVE_INFINITY;
      return minsA - minsB;
    });

    const payLogins = sorted
      .map((r) => r.timeIn)
      .filter((t): t is string => t !== null);
    const payLogouts = sorted
      .map((r) => r.timeOut)
      .filter((t): t is string => t !== null);

    const payBreaks: PayBreakSegment[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const breakOut = sorted[i].timeOut;
      const breakIn = sorted[i + 1].timeIn;
      if (breakOut === null || breakIn === null) continue;

      const breakOutMins = parseTimeToMinutes(breakOut);
      const breakInMins = parseTimeToMinutes(breakIn);
      if (
        breakOutMins === null ||
        breakInMins === null ||
        breakInMins <= breakOutMins
      ) {
        continue;
      }

      payBreaks.push({ breakOut, breakIn });
    }

    result.push({
      payrollName: sorted[0].payrollName,
      payDate: sorted[0].payDate,
      payLogin: sorted[0].timeIn,
      payLogout: sorted[sorted.length - 1].timeOut,
      payLogins,
      payLogouts,
      payBreaks,
      payBreakOut: payBreaks.length === 1 ? payBreaks[0].breakOut : null,
      payBreakIn: payBreaks.length === 1 ? payBreaks[0].breakIn : null,
      earnCode: sorted[0].earnCode,
    });
  }

  return result;
}

const PAYROLL_EXPORT_HEADERS = [
  'Payroll Name',
  'Pay Date',
  'Time In',
  'Time Out',
  'Earnings Code',
];

export async function parsePayrollExportWorkbook(
  buffer: Buffer,
): Promise<PayrollExportRow[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Payroll Export file has no worksheets');
  }

  const headerRow = worksheet.getRow(1);
  const headerIndex = buildHeaderIndex(headerRow, PAYROLL_EXPORT_HEADERS);
  const payrollNameCol = headerColumn(headerIndex, 'Payroll Name');
  const payDateCol = headerColumn(headerIndex, 'Pay Date');
  const timeInCol = headerColumn(headerIndex, 'Time In');
  const timeOutCol = headerColumn(headerIndex, 'Time Out');
  const earnCodeCol = headerColumn(headerIndex, 'Earnings Code');

  if (!payrollNameCol || !payDateCol) {
    throw new Error(
      'Payroll Export file is missing required columns: Payroll Name / Pay Date',
    );
  }

  const rows: PayrollExportRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const payrollName = cellToString(row.getCell(payrollNameCol).value);
    const payDate = cellToDateValue(row.getCell(payDateCol).value);
    if (payrollName === null || payDate === null) return;

    rows.push({
      payrollName,
      payDate,
      timeIn: timeInCol ? cellToTimeString(row.getCell(timeInCol).value) : null,
      timeOut: timeOutCol
        ? cellToTimeString(row.getCell(timeOutCol).value)
        : null,
      earnCode: earnCodeCol
        ? cellToString(row.getCell(earnCodeCol).value)
        : null,
    });
  });

  return rows;
}
