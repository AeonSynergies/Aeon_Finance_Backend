const TWELVE_HOUR_PATTERN = /^(\d{1,2}):(\d{2})\s*([APap][Mm])$/;
const TWENTY_FOUR_HOUR_WITH_SECONDS_PATTERN = /^(\d{1,2}):(\d{2}):\d{2}$/;

export function convertTo24Hour(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'missing') return null;

  const twelveHourMatch = trimmed.match(TWELVE_HOUR_PATTERN);
  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const isPm = twelveHourMatch[3].toUpperCase() === 'PM';
    if (hours === 12) hours = isPm ? 12 : 0;
    else if (isPm) hours += 12;
    return (
      String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
    );
  }

  const withSecondsMatch = trimmed.match(TWENTY_FOUR_HOUR_WITH_SECONDS_PATTERN);
  if (withSecondsMatch) {
    return withSecondsMatch[1].padStart(2, '0') + ':' + withSecondsMatch[2];
  }

  return trimmed;
}

export function normalizeDateToIso(
  raw: string | Date | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return null;
}

export function normalizeName(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'missing') return null;
  return trimmed;
}
