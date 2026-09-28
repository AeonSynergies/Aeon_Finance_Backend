import { validateMealBreak } from './mealBreak';

describe('validateMealBreak (Rule 5 — Meal Break Validation)', () => {
  it('does not trigger when neither Amazon nor payroll has a break', () => {
    const result = validateMealBreak({
      amazonBreaks: [],
      payBreakOut: null,
      payBreakIn: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger when Amazon has a break but payroll is missing one (defers to Rule 9)', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: null,
      payBreakIn: null,
    });

    expect(result.triggered).toBe(false);
  });

  it('treats an empty-string payroll break the same as a null one (defers to Rule 9)', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: '',
      payBreakIn: '',
    });

    expect(result.triggered).toBe(false);
  });

  it('does not trigger within the default 2m buffer (base comparison)', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: '12:01',
      payBreakIn: '12:29',
    });

    expect(result.triggered).toBe(false);
  });

  it('triggers outside the default 2m buffer, with a genuine duration difference (Q24: base comparison)', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: '12:10',
      payBreakIn: '12:50',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_DURATION_DIFFERENCE');
  });

  it('Q24: does NOT trigger when total durations match closely, even if the specific start/end times differ -- the fallback compares total duration, not clock times', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
      payBreakOut: '12:10',
      payBreakIn: '12:40',
    });

    expect(result.triggered).toBe(false);
  });

  it('Exception 1: a short (<=15m) Amazon break means the payroll break should be deleted, regardless of its own duration', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:15' }],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_TIME_DIFFERENCE');
    expect(result.detail).toContain('Exception 1');
  });

  it('Q16: a 0-minute Amazon segment (identical start/end) counts as real data, not discarded as a glitch -- it still triggers Exception 1, proving it was not silently dropped to an empty amazonBreaks case', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '12:00' }],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_TIME_DIFFERENCE');
    expect(result.detail).toContain('0m');
    expect(result.detail).toContain('Exception 1');
  });

  it('Exception 2: payroll break inside a longer Amazon window is fine', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '13:00' }],
      payBreakOut: '12:15',
      payBreakIn: '12:45',
    });

    expect(result.triggered).toBe(false);
    expect(result.detail).toContain('Exception 2');
  });

  it('Exception 2 requires strict containment with no buffer, matching the literal BRS text exactly', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '13:00' }],
      payBreakOut: '11:59',
      payBreakIn: '12:45',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_DURATION_DIFFERENCE');
  });

  it('Exception 2 does not apply when payroll break is not fully inside the Amazon window, and falls back to a duration mismatch (Q24)', () => {
    const result = validateMealBreak({
      amazonBreaks: [{ breakOut: '12:00', breakIn: '13:00' }],
      payBreakOut: '11:50',
      payBreakIn: '12:20',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_DURATION_DIFFERENCE');
  });

  it('Exception 3 (updated per business owner Q17/Q27): merely summing to the payroll duration is no longer sufficient on its own -- the nearest individual segment must itself overlap or closely match', () => {
    const result = validateMealBreak({
      amazonBreaks: [
        { breakOut: '12:00', breakIn: '12:15' },
        { breakOut: '12:15', breakIn: '12:30' },
      ],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_TIME_DIFFERENCE');
  });

  it("Exception 3: exactly 2 segments totaling >20m are fine when the nearest one contains payroll's break", () => {
    const result = validateMealBreak({
      amazonBreaks: [
        { breakOut: '12:00', breakIn: '12:20' },
        { breakOut: '13:00', breakIn: '13:05' },
      ],
      payBreakOut: '12:01',
      payBreakIn: '12:19',
    });

    expect(result.triggered).toBe(false);
    expect(result.detail).toContain('Exception 3');
  });

  it('Exception 3 does not apply when the 2 segments total 20m or less, even if they would otherwise line up', () => {
    const result = validateMealBreak({
      amazonBreaks: [
        { breakOut: '12:00', breakIn: '12:10' },
        { breakOut: '12:20', breakIn: '12:30' },
      ],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_TIME_DIFFERENCE');
  });

  it('Exception 3 no longer applies to 3+ segments (Q27: exactly two, not any count)', () => {
    const result = validateMealBreak({
      amazonBreaks: [
        { breakOut: '12:00', breakIn: '12:10' },
        { breakOut: '12:15', breakIn: '12:25' },
        { breakOut: '12:30', breakIn: '12:40' },
      ],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('BREAK_TIME_DIFFERENCE');
  });

  it('Exception 4: no Amazon break, payroll break exists, no deliveries during it - fine', () => {
    const result = validateMealBreak({
      amazonBreaks: [],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
      deliveryTimestamps: ['09:00', '15:00'],
    });

    expect(result.triggered).toBe(false);
  });

  it('Exception 4: no Amazon break, payroll break exists, a delivery happened during it - should be deleted', () => {
    const result = validateMealBreak({
      amazonBreaks: [],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
      deliveryTimestamps: ['12:15'],
    });

    expect(result.triggered).toBe(true);
    expect(result.status).toBe('DELIVERY_DURING_BREAK');
    expect(result.detail).toContain('Exception 4');
  });

  it('Exception 4: delivery data unavailable - check is skipped, not failed', () => {
    const result = validateMealBreak({
      amazonBreaks: [],
      payBreakOut: '12:00',
      payBreakIn: '12:30',
      deliveryTimestamps: null,
    });

    expect(result.triggered).toBe(false);
    expect(result.detail).toContain('skipped');
  });

  it('respects a configured buffer override from Settings', () => {
    const withinCustomBuffer = validateMealBreak(
      {
        amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
        payBreakOut: '12:00',
        payBreakIn: '12:33',
      },
      { mealBreakBufferMins: 5 },
    );
    const outsideCustomBuffer = validateMealBreak(
      {
        amazonBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
        payBreakOut: '12:00',
        payBreakIn: '12:40',
      },
      { mealBreakBufferMins: 5 },
    );

    expect(withinCustomBuffer.triggered).toBe(false);
    expect(outsideCustomBuffer.triggered).toBe(true);
    expect(outsideCustomBuffer.status).toBe('BREAK_DURATION_DIFFERENCE');
  });
});
