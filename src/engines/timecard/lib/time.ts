export function parseTimeToMinutes(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesDiff(
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  const minsA = parseTimeToMinutes(a);
  const minsB = parseTimeToMinutes(b);
  if (minsA === null || minsB === null) return null;
  return Math.abs(minsA - minsB);
}

export function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}
