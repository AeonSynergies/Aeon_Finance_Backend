export enum JobStatus {
  DRAFT_INPROGRESS = 'DRAFT_INPROGRESS',
  SENT_FOR_APPROVAL = 'SENT_FOR_APPROVAL',
  APPROVED = 'APPROVED',
  LOCKED = 'LOCKED',
}

interface DateApprovalForStatus {
  date: Date;
  status: string;
}

interface JobStatusInput {
  periodStart: Date;
  periodEnd: Date;
  lockedAt: Date | null;
  dateApprovals: DateApprovalForStatus[];
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function everyDateKeyInPeriod(periodStart: Date, periodEnd: Date): string[] {
  const msPerDay = 24 * 60 * 60 * 1000;
  const keys: string[] = [];
  for (
    let time = periodStart.getTime();
    time <= periodEnd.getTime();
    time += msPerDay
  ) {
    keys.push(toDateKey(new Date(time)));
  }
  return keys;
}

export function computeJobStatus(job: JobStatusInput): JobStatus {
  if (job.lockedAt) {
    return JobStatus.LOCKED;
  }

  const approvedDateKeys = new Set(
    job.dateApprovals
      .filter((da) => da.status === 'APPROVED')
      .map((da) => toDateKey(da.date)),
  );

  const periodDateKeys = everyDateKeyInPeriod(job.periodStart, job.periodEnd);
  const allDatesApproved =
    periodDateKeys.length > 0 &&
    periodDateKeys.every((key) => approvedDateKeys.has(key));

  if (allDatesApproved) {
    return JobStatus.APPROVED;
  }

  const hasAnySubmission = job.dateApprovals.some(
    (da) => da.status === 'SENT_FOR_APPROVAL' || da.status === 'APPROVED',
  );
  if (hasAnySubmission) {
    return JobStatus.SENT_FOR_APPROVAL;
  }

  return JobStatus.DRAFT_INPROGRESS;
}
