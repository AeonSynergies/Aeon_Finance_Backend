import { parse } from 'csv-parse/sync';
import {
  convertTo24Hour,
  normalizeDateToIso,
  normalizeName,
} from './timeFormat';

export interface BreakReportRow {
  daName: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  reportSource: string | null;
}

export interface AmazonBreakSegment {
  breakOut: string;
  breakIn: string;
}

export interface AmazonBreakDay {
  amazonName: string;
  date: string;
  segments: AmazonBreakSegment[];
}

const VALID_REPORT_SOURCE = 'delivery app';

export function parseBreakReport(
  rows: BreakReportRow[],
  date: string,
): AmazonBreakDay[] {
  const byDriver = new Map<string, AmazonBreakSegment[]>();

  for (const row of rows) {
    const amazonName = normalizeName(row.daName);
    if (amazonName === null) continue;

    const source = (row.reportSource ?? '').trim().toLowerCase();
    if (source !== VALID_REPORT_SOURCE) continue;

    const breakOut = convertTo24Hour(row.breakStartTime);
    const breakIn = convertTo24Hour(row.breakEndTime);
    if (breakOut === null || breakIn === null) continue;

    const segments = byDriver.get(amazonName) ?? [];
    segments.push({ breakOut, breakIn });
    byDriver.set(amazonName, segments);
  }

  return Array.from(byDriver.entries()).map(([amazonName, segments]) => ({
    amazonName,
    date,
    segments,
  }));
}

function normalizeCsvHeaderLabel(label: string): string {
  return label.trim().replace(/:$/, '').toLowerCase();
}

const BREAK_REPORT_HEADERS = [
  'DA Name',
  'Break Start Time',
  'Break End Time',
  'Report Source',
];

export interface ParsedBreakReportFile {
  rows: BreakReportRow[];
  date: string | null;
}

export function parseBreakReportCsv(buffer: Buffer): ParsedBreakReportFile {
  const records = parse(buffer, {
    relax_column_count: true,
    skip_empty_lines: false,
  });

  let date: string | null = null;
  let headerRowIndex = -1;
  let headerIndex = new Map<string, number>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (row.length === 0) continue;

    if (date === null && normalizeCsvHeaderLabel(row[0] ?? '') === 'date') {
      date = normalizeDateToIso(row[1] ?? null);
      continue;
    }

    if (headerRowIndex === -1) {
      const candidateIndex = new Map<string, number>();
      row.forEach((cell, colIndex) => {
        candidateIndex.set(normalizeCsvHeaderLabel(cell ?? ''), colIndex);
      });
      if (candidateIndex.has('da name')) {
        headerRowIndex = i;
        headerIndex = candidateIndex;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      `Amazon Break Report file is missing required column: ${BREAK_REPORT_HEADERS[0]}`,
    );
  }

  const daNameCol = headerIndex.get('da name');
  const breakStartCol = headerIndex.get('break start time');
  const breakEndCol = headerIndex.get('break end time');
  const reportSourceCol = headerIndex.get('report source');

  const rows: BreakReportRow[] = [];
  for (let i = headerRowIndex + 1; i < records.length; i++) {
    const row = records[i];
    if (!row || row.length === 0) continue;

    const daName = daNameCol !== undefined ? (row[daNameCol] ?? null) : null;
    if (daName === null || daName.trim() === '') continue;

    rows.push({
      daName,
      breakStartTime:
        breakStartCol !== undefined ? (row[breakStartCol] ?? null) : null,
      breakEndTime:
        breakEndCol !== undefined ? (row[breakEndCol] ?? null) : null,
      reportSource:
        reportSourceCol !== undefined ? (row[reportSourceCol] ?? null) : null,
    });
  }

  return { rows, date };
}
