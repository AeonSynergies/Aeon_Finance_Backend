import { buildTimecardRows } from './buildTimecardRows';
import { validateTimecardRow } from '../sequencer';
import type { GroupedPayrollDay } from './payrollExport';
import type { AmazonItineraryDay } from './amazonItinerary';
import type { AmazonBreakDay } from './breakReport';

function payrollDay(
  overrides: Partial<GroupedPayrollDay> = {},
): GroupedPayrollDay {
  return {
    payrollName: 'Doe, John',
    payDate: '2026-07-05',
    payLogin: '09:00',
    payLogout: '18:00',
    payLogins: ['09:00'],
    payLogouts: ['18:00'],
    payBreaks: [{ breakOut: '12:00', breakIn: '12:30' }],
    payBreakOut: '12:00',
    payBreakIn: '12:30',
    earnCode: null,
    ...overrides,
  };
}

describe('buildTimecardRows', () => {
  it('matches a payroll row to its Amazon Itinerary row by name and wires up the fields', () => {
    const itinerary: AmazonItineraryDay[] = [
      {
        amazonName: 'John,Doe',
        date: '2026-07-05',
        appLogin: '09:02',
        appLogout: '18:05',
        lastStop: '17:45',
      },
    ];
    const breaks: AmazonBreakDay[] = [
      {
        amazonName: 'John,Doe',
        date: '2026-07-05',
        segments: [{ breakOut: '12:00', breakIn: '12:30' }],
      },
    ];

    const rows = buildTimecardRows([payrollDay()], itinerary, breaks);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.payrollName).toBe('Doe, John');
    expect(row.appLogin).toBe('09:02');
    expect(row.appLogout).toBe('18:05');
    expect(row.lastStop).toBe('17:45');
    expect(row.amazonBreaks).toEqual([{ breakOut: '12:00', breakIn: '12:30' }]);
    expect(row.employeeMasterList).toEqual([
      { employeeId: 'John,Doe', name: 'John,Doe' },
    ]);
  });

  it('leaves Amazon fields empty when no Itinerary row exists for that date at all', () => {
    const rows = buildTimecardRows([payrollDay()], [], []);

    expect(rows[0].appLogin).toBeNull();
    expect(rows[0].appLogout).toBeNull();
    expect(rows[0].lastStop).toBeNull();
    expect(rows[0].amazonBreaks).toEqual([]);
    expect(rows[0].employeeMasterList).toEqual([]);
  });

  it("leaves Amazon fields empty when the driver genuinely has no match in that date's Itinerary", () => {
    const itinerary: AmazonItineraryDay[] = [
      {
        amazonName: 'Someone,Else',
        date: '2026-07-05',
        appLogin: '09:02',
        appLogout: '18:05',
        lastStop: '17:45',
      },
    ];

    const rows = buildTimecardRows([payrollDay()], itinerary, []);

    expect(rows[0].appLogin).toBeNull();
    expect(rows[0].appLogout).toBeNull();
  });

  it("only matches against the same date's Itinerary rows, not other dates", () => {
    const itinerary: AmazonItineraryDay[] = [
      {
        amazonName: 'John,Doe',
        date: '2026-07-06',
        appLogin: '09:02',
        appLogout: '18:05',
        lastStop: '17:45',
      },
    ];

    const rows = buildTimecardRows(
      [payrollDay({ payDate: '2026-07-05' })],
      itinerary,
      [],
    );

    expect(rows[0].appLogin).toBeNull();
  });

  it('produces a row that the sequencer can actually validate end to end (clean day)', () => {
    const itinerary: AmazonItineraryDay[] = [
      {
        amazonName: 'John,Doe',
        date: '2026-07-05',
        appLogin: '09:00',
        appLogout: '18:00',
        lastStop: '17:45',
      },
    ];
    const breaks: AmazonBreakDay[] = [
      {
        amazonName: 'John,Doe',
        date: '2026-07-05',
        segments: [{ breakOut: '12:00', breakIn: '12:30' }],
      },
    ];

    const rows = buildTimecardRows([payrollDay()], itinerary, breaks);
    const result = validateTimecardRow(rows[0]);

    expect(result.status).toBe('GOOD_NO_ERROR');
    expect(result.employeeId).toBe('John,Doe');
  });

  it('produces a row that the sequencer correctly flags as unmatched when no real Amazon driver exists', () => {
    const rows = buildTimecardRows([payrollDay()], [], []);
    const result = validateTimecardRow(rows[0]);

    expect(result.status).toBe('EMPLOYEE_NOT_MATCHED');
  });

  it('matches Amazon Break Report segments even though the Break Report names drivers in a different format than the Itinerary', () => {
    const itinerary: AmazonItineraryDay[] = [
      {
        amazonName: 'Yackson,Giraldo Damian',
        date: '2026-07-09',
        appLogin: '10:45',
        appLogout: '21:33',
        lastStop: '21:00',
      },
    ];
    const breaks: AmazonBreakDay[] = [
      {
        amazonName: 'Yackson Giraldo Damian',
        date: '2026-07-09',
        segments: [{ breakOut: '15:00', breakIn: '15:30' }],
      },
    ];

    const rows = buildTimecardRows(
      [
        payrollDay({
          payrollName: 'Damian, Yackson Giraldo',
          payDate: '2026-07-09',
        }),
      ],
      itinerary,
      breaks,
    );

    expect(rows[0].amazonBreaks).toEqual([
      { breakOut: '15:00', breakIn: '15:30' },
    ]);
  });

  it('handles multiple drivers on the same date independently', () => {
    const payrollDays = [
      payrollDay({ payrollName: 'Doe, John' }),
      payrollDay({
        payrollName: 'Smith, Jane',
        payLogin: '08:00',
        payLogout: '16:00',
      }),
    ];
    const itinerary: AmazonItineraryDay[] = [
      {
        amazonName: 'John,Doe',
        date: '2026-07-05',
        appLogin: '09:00',
        appLogout: '18:00',
        lastStop: '17:45',
      },
      {
        amazonName: 'Jane,Smith',
        date: '2026-07-05',
        appLogin: '08:00',
        appLogout: '16:00',
        lastStop: '15:45',
      },
    ];

    const rows = buildTimecardRows(payrollDays, itinerary, []);

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.payrollName === 'Doe, John')?.appLogin).toBe(
      '09:00',
    );
    expect(rows.find((r) => r.payrollName === 'Smith, Jane')?.appLogin).toBe(
      '08:00',
    );
  });
});
