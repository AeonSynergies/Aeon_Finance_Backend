import { Workbook } from 'exceljs';
import { convertTo24Hour, normalizeName } from './timeFormat';
import {
  buildHeaderIndex,
  cellToString,
  headerColumn,
} from './workbookHelpers';

export interface AmazonItineraryRow {
  driverName: string | null;
  appSignIn: string | null;
  appSignOut: string | null;
  lastStopExecutionTime: string | null;
}

export interface AmazonItineraryDay {
  amazonName: string;
  date: string;
  appLogin: string | null;
  appLogout: string | null;
  lastStop: string | null;
}

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const DATE_PREFIXED_TIME_PATTERN =
  /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([APap][Mm])$/;

const BROKEN_SIGN_OUT_HOUR_CUTOFF = 6;

function resolveAppLogout(
  raw: string | null,
  shiftDate: string,
): string | null {
  const converted = convertTo24Hour(raw);
  if (converted === null) return null;

  if (/^\d{2}:\d{2}$/.test(converted)) {
    const hours = Number(converted.slice(0, 2));
    return hours < BROKEN_SIGN_OUT_HOUR_CUTOFF ? null : converted;
  }

  const match = converted.trim().match(DATE_PREFIXED_TIME_PATTERN);
  if (!match) return null;

  const month = MONTH_ABBREVIATIONS[match[1].toLowerCase()];
  if (!month) return null;
  const day = Number(match[2]);
  let hours = Number(match[3]);
  const minutes = Number(match[4]);
  if (minutes > 59) return null;
  const isPm = match[5].toUpperCase() === 'PM';
  if (hours === 12) hours = isPm ? 12 : 0;
  else if (isPm) hours += 12;
  if (hours > 23) return null;

  const [, shiftMonth, shiftDay] = shiftDate.split('-').map(Number);
  if (month !== shiftMonth || day !== shiftDay) return null;
  if (hours < BROKEN_SIGN_OUT_HOUR_CUTOFF) return null;

  return (
    String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
  );
}

export function parseAmazonItinerary(
  rows: AmazonItineraryRow[],
  date: string,
): AmazonItineraryDay[] {
  const result: AmazonItineraryDay[] = [];

  for (const row of rows) {
    const amazonName = normalizeName(row.driverName);
    if (amazonName === null) continue;

    result.push({
      amazonName,
      date,
      appLogin: convertTo24Hour(row.appSignIn),
      appLogout: resolveAppLogout(row.appSignOut, date),
      lastStop: convertTo24Hour(row.lastStopExecutionTime),
    });
  }

  return result;
}

const AMAZON_ITINERARY_HEADERS = [
  'Driver name',
  'App sign in',
  'App sign out',
  'Last stop execution time',
];

export async function parseAmazonItineraryWorkbook(
  buffer: Buffer,
): Promise<AmazonItineraryRow[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Amazon Itinerary file has no worksheets');
  }

  const headerRow = worksheet.getRow(1);
  const headerIndex = buildHeaderIndex(headerRow, AMAZON_ITINERARY_HEADERS);
  const driverNameCol = headerColumn(headerIndex, 'Driver name');
  const appSignInCol = headerColumn(headerIndex, 'App sign in');
  const appSignOutCol = headerColumn(headerIndex, 'App sign out');
  const lastStopCol = headerColumn(headerIndex, 'Last stop execution time');

  if (!driverNameCol) {
    throw new Error(
      'Amazon Itinerary file is missing required column: Driver name',
    );
  }

  const rows: AmazonItineraryRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const driverName = cellToString(row.getCell(driverNameCol).value);
    if (driverName === null) return;

    rows.push({
      driverName,
      appSignIn: appSignInCol
        ? cellToString(row.getCell(appSignInCol).value)
        : null,
      appSignOut: appSignOutCol
        ? cellToString(row.getCell(appSignOutCol).value)
        : null,
      lastStopExecutionTime: lastStopCol
        ? cellToString(row.getCell(lastStopCol).value)
        : null,
    });
  });

  return rows;
}
