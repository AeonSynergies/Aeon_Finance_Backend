import type { CellValue, Row } from 'exceljs';

function normalizeHeaderLabel(label: string): string {
  return label.trim().replace(/:$/, '').toLowerCase();
}

export function buildHeaderIndex(
  headerRow: Row,
  expectedHeaders: string[],
): Map<string, number> {
  const index = new Map<string, number>();
  const wanted = new Set(expectedHeaders.map(normalizeHeaderLabel));

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = cellToRawValue(cell.value);
    if (raw === null) return;
    const normalized = normalizeHeaderLabel(String(raw));
    if (wanted.has(normalized)) index.set(normalized, colNumber);
  });

  return index;
}

export function headerColumn(
  headerIndex: Map<string, number>,
  header: string,
): number | undefined {
  return headerIndex.get(normalizeHeaderLabel(header));
}

export function cellToRawValue(
  value: CellValue,
): string | number | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('result' in value) {
      return (value.result as string | number | Date | null) ?? null;
    }
    if ('text' in value) {
      return value.text ?? null;
    }
    return null;
  }
  if (typeof value === 'boolean') return String(value);
  return value;
}

export function cellToString(value: CellValue): string | null {
  const raw = cellToRawValue(value);
  if (raw === null) return null;
  if (raw instanceof Date) return raw.toISOString();
  const str = String(raw).trim();
  return str === '' ? null : str;
}

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function cellToTimeString(value: CellValue): string | null {
  const raw = cellToRawValue(value);
  if (raw === null) return null;

  if (raw instanceof Date) {
    const hours = raw.getUTCHours();
    const minutes = raw.getUTCMinutes();
    const isPm = hours >= 12;
    let hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  }

  if (typeof raw === 'number') {
    const totalMinutes = Math.round((raw % 1) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const isPm = hours >= 12;
    let hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  }

  const str = raw.trim();
  return str === '' ? null : str;
}

export function cellToDateValue(value: CellValue): string | Date | null {
  const raw = cellToRawValue(value);
  if (raw === null) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    return new Date(EXCEL_EPOCH_UTC_MS + raw * MS_PER_DAY);
  }
  const str = raw.trim();
  return str === '' ? null : str;
}
