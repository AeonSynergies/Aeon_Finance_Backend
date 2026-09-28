import type { RuleOutcome, TimecardThresholds } from '../types';
import { minutesDiff, parseTimeToMinutes } from '../lib/time';

export interface AmazonBreakSegment {
  breakOut: string;
  breakIn: string;
}

export interface MealBreakInput {
  amazonBreaks: AmazonBreakSegment[];
  payBreakOut: string | null;
  payBreakIn: string | null;
  deliveryTimestamps?: string[] | null;
}

const DEFAULT_MEAL_BREAK_BUFFER_MINS = 2;
const SHORT_BREAK_THRESHOLD_MINS = 15;
const MULTI_SEGMENT_TOTAL_THRESHOLD_MINS = 20;

function segmentDuration(segment: AmazonBreakSegment): number | null {
  return minutesDiff(segment.breakOut, segment.breakIn);
}

function segmentMatchesPayroll(
  segment: AmazonBreakSegment,
  payBreakOut: string | null,
  payBreakIn: string | null,
  buffer: number,
): 'CONTAINMENT' | 'PROXIMITY' | null {
  const payStart = parseTimeToMinutes(payBreakOut);
  const payEnd = parseTimeToMinutes(payBreakIn);
  const segStart = parseTimeToMinutes(segment.breakOut);
  const segEnd = parseTimeToMinutes(segment.breakIn);

  if (
    segStart !== null &&
    segEnd !== null &&
    payStart !== null &&
    payEnd !== null &&
    payStart >= segStart &&
    payEnd <= segEnd
  ) {
    return 'CONTAINMENT';
  }

  const outDiff = minutesDiff(segment.breakOut, payBreakOut);
  const inDiff = minutesDiff(segment.breakIn, payBreakIn);
  if (
    outDiff !== null &&
    inDiff !== null &&
    outDiff <= buffer &&
    inDiff <= buffer
  ) {
    return 'PROXIMITY';
  }

  return null;
}

function nearestSegment(
  segments: { segment: AmazonBreakSegment; duration: number }[],
  payBreakOut: string | null,
): AmazonBreakSegment {
  const payStart = parseTimeToMinutes(payBreakOut);
  return segments.reduce((best, current) => {
    const bestStart = parseTimeToMinutes(best.segment.breakOut);
    const currentStart = parseTimeToMinutes(current.segment.breakOut);
    if (payStart === null || currentStart === null) return best;
    if (bestStart === null) return current;
    return Math.abs(currentStart - payStart) < Math.abs(bestStart - payStart)
      ? current
      : best;
  }).segment;
}

function isWithinWindow(
  timestamp: string,
  windowStart: string | null,
  windowEnd: string | null,
): boolean {
  const ts = parseTimeToMinutes(timestamp);
  const start = parseTimeToMinutes(windowStart);
  const end = parseTimeToMinutes(windowEnd);
  return (
    ts !== null && start !== null && end !== null && ts >= start && ts <= end
  );
}

export function validateMealBreak(
  input: MealBreakInput,
  thresholds: TimecardThresholds = {},
): RuleOutcome {
  const buffer =
    thresholds.mealBreakBufferMins ?? DEFAULT_MEAL_BREAK_BUFFER_MINS;

  const validAmazonSegments = input.amazonBreaks
    .map((segment) => ({ segment, duration: segmentDuration(segment) }))
    .filter(
      (entry): entry is { segment: AmazonBreakSegment; duration: number } =>
        entry.duration !== null,
    );

  const hasPayrollBreak =
    input.payBreakOut !== null &&
    input.payBreakOut.trim() !== '' &&
    input.payBreakIn !== null &&
    input.payBreakIn.trim() !== '';

  if (validAmazonSegments.length === 0) {
    if (!hasPayrollBreak) {
      return { triggered: false };
    }

    if (
      input.deliveryTimestamps === null ||
      input.deliveryTimestamps === undefined
    ) {
      return {
        triggered: false,
        detail:
          'Delivery data unavailable - delivery-during-break check skipped (Exception 4)',
      };
    }

    const deliveryDuringBreak = input.deliveryTimestamps.some((ts) =>
      isWithinWindow(ts, input.payBreakOut, input.payBreakIn),
    );

    if (deliveryDuringBreak) {
      return {
        triggered: true,
        status: 'DELIVERY_DURING_BREAK',
        detail:
          'Delivery recorded during claimed payroll break with no Amazon break on file - payroll break should be deleted (Exception 4)',
      };
    }

    return {
      triggered: false,
      detail: 'No deliveries during payroll break (Exception 4)',
    };
  }

  if (!hasPayrollBreak) {
    return { triggered: false };
  }

  const totalAmazonMinutes = validAmazonSegments.reduce(
    (sum, e) => sum + e.duration,
    0,
  );

  if (
    validAmazonSegments.length === 1 &&
    totalAmazonMinutes <= SHORT_BREAK_THRESHOLD_MINS
  ) {
    return {
      triggered: true,
      status: 'BREAK_TIME_DIFFERENCE',
      detail: `Amazon shows only a ${totalAmazonMinutes}m break - payroll break should be deleted (Exception 1)`,
    };
  }

  if (
    validAmazonSegments.length === 2 &&
    totalAmazonMinutes > MULTI_SEGMENT_TOTAL_THRESHOLD_MINS
  ) {
    const nearest = nearestSegment(validAmazonSegments, input.payBreakOut);
    const matchType = segmentMatchesPayroll(
      nearest,
      input.payBreakOut,
      input.payBreakIn,
      buffer,
    );
    if (matchType !== null) {
      return {
        triggered: false,
        detail: `2 Amazon break segments (${totalAmazonMinutes}m total); nearest segment (${nearest.breakOut}-${nearest.breakIn}) matches payroll's break (Exception 3)`,
      };
    }
  }

  if (validAmazonSegments.length === 1) {
    const [{ segment }] = validAmazonSegments;
    const matchType = segmentMatchesPayroll(
      segment,
      input.payBreakOut,
      input.payBreakIn,
      buffer,
    );

    if (matchType === 'CONTAINMENT') {
      return {
        triggered: false,
        detail:
          "Payroll break falls inside Amazon's longer break window (Exception 2)",
      };
    }
    if (matchType === 'PROXIMITY') {
      return { triggered: false };
    }

    const payrollDuration = minutesDiff(input.payBreakOut, input.payBreakIn);
    const durationDiff =
      payrollDuration !== null
        ? Math.abs(totalAmazonMinutes - payrollDuration)
        : null;

    if (durationDiff !== null && durationDiff <= buffer) {
      return { triggered: false };
    }

    return {
      triggered: true,
      status: 'BREAK_DURATION_DIFFERENCE',
      detail:
        durationDiff !== null
          ? `Payroll break (${payrollDuration}m) differs from Amazon's total break time (${totalAmazonMinutes}m) by ${durationDiff}m, exceeding the ${buffer}m buffer`
          : `Payroll meal break differs from Amazon meal break by more than the ${buffer}m buffer`,
    };
  }

  return {
    triggered: true,
    status: 'BREAK_TIME_DIFFERENCE',
    detail: `Payroll meal break differs from Amazon meal break by more than the ${buffer}m buffer`,
  };
}
