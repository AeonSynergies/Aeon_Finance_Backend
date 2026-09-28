import {
  matchEmployee,
  namesLikelyMatch,
  type EmployeeMasterRecord,
} from '../rules/employeeMatching';
import type { TimecardRowInput } from '../sequencer';
import type { GroupedPayrollDay } from './payrollExport';
import type { AmazonItineraryDay } from './amazonItinerary';
import type { AmazonBreakDay } from './breakReport';

function buildSyntheticMasterList(
  daysForDate: { amazonName: string }[],
): EmployeeMasterRecord[] {
  return daysForDate.map((day) => ({
    employeeId: day.amazonName,
    name: day.amazonName,
  }));
}

export function buildTimecardRows(
  payrollDays: GroupedPayrollDay[],
  itineraryDays: AmazonItineraryDay[],
  breakDays: AmazonBreakDay[],
): TimecardRowInput[] {
  const itineraryByDate = new Map<string, AmazonItineraryDay[]>();
  for (const day of itineraryDays) {
    const list = itineraryByDate.get(day.date) ?? [];
    list.push(day);
    itineraryByDate.set(day.date, list);
  }

  const breaksByDate = new Map<string, AmazonBreakDay[]>();
  for (const day of breakDays) {
    const list = breaksByDate.get(day.date) ?? [];
    list.push(day);
    breaksByDate.set(day.date, list);
  }

  return payrollDays.map((payrollDay) => {
    const itineraryForDate = itineraryByDate.get(payrollDay.payDate) ?? [];
    const employeeMasterList = buildSyntheticMasterList(itineraryForDate);
    const breaksForDate = breaksByDate.get(payrollDay.payDate) ?? [];
    const breakReportMasterList = buildSyntheticMasterList(breaksForDate);

    const match = matchEmployee(
      {
        payrollName: payrollDay.payrollName,
        payrollDlNumber: null,
        amazonName: null,
      },
      employeeMasterList,
      breakReportMasterList,
    );

    const matchedItinerary = match.employeeId
      ? (itineraryForDate.find((day) => day.amazonName === match.employeeId) ??
        null)
      : null;

    const matchedBreaks = match.employeeId
      ? (breaksForDate.find((day) =>
          namesLikelyMatch(day.amazonName, match.employeeId as string),
        ) ?? null)
      : null;

    const row: TimecardRowInput = {
      payrollName: payrollDay.payrollName,
      payrollDlNumber: null,
      amazonName: null,
      employeeMasterList,
      breakReportMasterList,

      payLogin: payrollDay.payLogin,
      payLogout: payrollDay.payLogout,
      payBreakOut: payrollDay.payBreakOut,
      payBreakIn: payrollDay.payBreakIn,
      waveStartTime: null,
      appLogin: matchedItinerary?.appLogin ?? null,
      appLogout: matchedItinerary?.appLogout ?? null,
      physicalLogin: null,
      lastStop: matchedItinerary?.lastStop ?? null,
      amazonBreaks: matchedBreaks?.segments ?? [],
      deliveryTimestamps: null,

      payLogins: payrollDay.payLogins,
      payLogouts: payrollDay.payLogouts,
      payBreaks: payrollDay.payBreaks,

      earnCode: payrollDay.earnCode,
    };

    return row;
  });
}
