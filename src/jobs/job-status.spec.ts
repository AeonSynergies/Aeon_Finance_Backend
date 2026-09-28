import { computeJobStatus, JobStatus } from './job-status';

const PERIOD_START = new Date('2026-07-05T00:00:00Z');
const PERIOD_END = new Date('2026-07-11T00:00:00Z');

function dateApprovalsForAllSevenDays(status: string) {
  return [
    { date: new Date('2026-07-05T00:00:00Z'), status },
    { date: new Date('2026-07-06T00:00:00Z'), status },
    { date: new Date('2026-07-07T00:00:00Z'), status },
    { date: new Date('2026-07-08T00:00:00Z'), status },
    { date: new Date('2026-07-09T00:00:00Z'), status },
    { date: new Date('2026-07-10T00:00:00Z'), status },
    { date: new Date('2026-07-11T00:00:00Z'), status },
  ];
}

describe('computeJobStatus', () => {
  it('returns DRAFT_INPROGRESS when there are zero DateApproval rows', () => {
    const status = computeJobStatus({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      lockedAt: null,
      dateApprovals: [],
    });
    expect(status).toBe(JobStatus.DRAFT_INPROGRESS);
  });

  it('returns SENT_FOR_APPROVAL when some but not all dates are submitted', () => {
    const status = computeJobStatus({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      lockedAt: null,
      dateApprovals: [
        { date: new Date('2026-07-05T00:00:00Z'), status: 'SENT_FOR_APPROVAL' },
      ],
    });
    expect(status).toBe(JobStatus.SENT_FOR_APPROVAL);
  });

  it('returns APPROVED only when every date in the period is APPROVED', () => {
    const status = computeJobStatus({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      lockedAt: null,
      dateApprovals: dateApprovalsForAllSevenDays('APPROVED'),
    });
    expect(status).toBe(JobStatus.APPROVED);
  });

  it('does not return APPROVED when one real in-period date is still unapproved, even if an out-of-period row inflates the count to match', () => {
    const sixOfSevenApproved = dateApprovalsForAllSevenDays('APPROVED').slice(
      0,
      6,
    );
    const outOfPeriodRow = {
      date: new Date('2026-07-12T00:00:00Z'),
      status: 'APPROVED',
    };

    const status = computeJobStatus({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      lockedAt: null,
      dateApprovals: [...sixOfSevenApproved, outOfPeriodRow],
    });

    expect(status).not.toBe(JobStatus.APPROVED);
    expect(status).toBe(JobStatus.SENT_FOR_APPROVAL);
  });

  it('returns LOCKED regardless of DateApproval state once lockedAt is set', () => {
    const status = computeJobStatus({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      lockedAt: new Date('2026-07-15T00:00:00Z'),
      dateApprovals: [],
    });
    expect(status).toBe(JobStatus.LOCKED);
  });

  it('currently treats a REJECTED-only date as untouched (DRAFT_INPROGRESS), not as a submission -- known, deliberately unresolved ambiguity, see BACKEND_FOUNDATION_PLAN.md Phase 5 notes; revisit when Phase 7 is built', () => {
    const status = computeJobStatus({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      lockedAt: null,
      dateApprovals: [
        { date: new Date('2026-07-05T00:00:00Z'), status: 'REJECTED' },
      ],
    });
    expect(status).toBe(JobStatus.DRAFT_INPROGRESS);
  });
});
