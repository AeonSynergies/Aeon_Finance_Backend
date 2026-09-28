const MODULE_PREFIX = 'TC';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface IsoWeek {
  week: number;
  isoYear: number;
}

function getIsoWeek(date: Date): IsoWeek {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7,
  );
  return { week, isoYear: d.getUTCFullYear() };
}

function clientWeekOf(sunday: Date): IsoWeek {
  const monday = new Date(sunday.getTime() + MS_PER_DAY);
  return getIsoWeek(monday);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function generateJobId(
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY',
  periodStart: Date,
): string {
  if (frequency === 'DAILY') {
    return `${MODULE_PREFIX}-${periodStart.getUTCFullYear()}-${pad2(periodStart.getUTCMonth() + 1)}-${pad2(periodStart.getUTCDate())}`;
  }

  const { week, isoYear } = clientWeekOf(periodStart);

  if (frequency === 'WEEKLY') {
    return `${MODULE_PREFIX}-${isoYear}-W${pad2(week)}`;
  }

  const secondWeekStart = new Date(periodStart.getTime() + 7 * MS_PER_DAY);
  const second = clientWeekOf(secondWeekStart);
  return `${MODULE_PREFIX}-${isoYear}-W${pad2(week)}-W${pad2(second.week)}`;
}
