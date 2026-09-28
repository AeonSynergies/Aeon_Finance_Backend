import { Workbook } from 'exceljs';
import {
  groupPayrollExport,
  parsePayrollExportWorkbook,
} from './payrollExport';

async function buildWorkbookBuffer(
  headers: string[],
  rows: (string | number | Date)[][],
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('1');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

describe('groupPayrollExport', () => {
  it('groups 2 punch rows (1 break) into a single day, matching the real sample pattern', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Alarcon, Jose',
        payDate: '2026-07-08T00:00:00.000Z',
        timeIn: '10:45 AM',
        timeOut: '04:47 PM',
        earnCode: '',
      },
      {
        payrollName: 'Alarcon, Jose',
        payDate: '2026-07-08T00:00:00.000Z',
        timeIn: '05:17 PM',
        timeOut: '08:19 PM',
        earnCode: '',
      },
    ]);

    expect(result).toHaveLength(1);
    const day = result[0];
    expect(day.payrollName).toBe('Alarcon, Jose');
    expect(day.payDate).toBe('2026-07-08');
    expect(day.payLogin).toBe('10:45');
    expect(day.payLogout).toBe('20:19');
    expect(day.payLogins).toEqual(['10:45', '17:17']);
    expect(day.payLogouts).toEqual(['16:47', '20:19']);
    expect(day.payBreaks).toEqual([{ breakOut: '16:47', breakIn: '17:17' }]);
    expect(day.payBreakOut).toBe('16:47');
    expect(day.payBreakIn).toBe('17:17');
  });

  it('treats a single punch row as no break at all', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '09:00 AM',
        timeOut: '05:00 PM',
        earnCode: '',
      },
    ]);

    expect(result[0].payBreaks).toEqual([]);
    expect(result[0].payBreakOut).toBeNull();
    expect(result[0].payBreakIn).toBeNull();
    expect(result[0].payLogin).toBe('09:00');
    expect(result[0].payLogout).toBe('17:00');
  });

  it('leaves payBreakOut/payBreakIn null when 3+ punches imply 2+ breaks (Rule 10 territory, not Rule 5/9)', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '09:00 AM',
        timeOut: '11:00 AM',
        earnCode: '',
      },
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '11:30 AM',
        timeOut: '02:00 PM',
        earnCode: '',
      },
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '02:30 PM',
        timeOut: '05:00 PM',
        earnCode: '',
      },
    ]);

    expect(result[0].payBreaks).toHaveLength(2);
    expect(result[0].payBreakOut).toBeNull();
    expect(result[0].payBreakIn).toBeNull();
    expect(result[0].payLogins).toEqual(['09:00', '11:30', '14:30']);
    expect(result[0].payLogouts).toEqual(['11:00', '14:00', '17:00']);
  });

  it('separates different drivers and different dates into separate groups', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '09:00 AM',
        timeOut: '05:00 PM',
        earnCode: '',
      },
      {
        payrollName: 'Smith, Jane',
        payDate: '2026-07-05',
        timeIn: '08:00 AM',
        timeOut: '04:00 PM',
        earnCode: '',
      },
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-06',
        timeIn: '09:00 AM',
        timeOut: '05:00 PM',
        earnCode: '',
      },
    ]);

    expect(result).toHaveLength(3);
  });

  it('normalizes a blank Earnings Code to REG, per the Developer Logic Reference ("Blank = REG")', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '09:00 AM',
        timeOut: '05:00 PM',
        earnCode: '',
      },
    ]);

    expect(result[0].earnCode).toBe('REG');
  });

  it('passes through a real earn code like PTO', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '10:45 AM',
        timeOut: '08:45 PM',
        earnCode: 'PTO',
      },
    ]);

    expect(result[0].earnCode).toBe('PTO');
  });

  it('drops a break pair that would run backwards because of a duplicate/garbage punch row, matching a real sample day', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Damian, Yackson Giraldo',
        payDate: '2026-07-10',
        timeIn: '10:45 AM',
        timeOut: '03:00 PM',
        earnCode: '',
      },
      {
        payrollName: 'Damian, Yackson Giraldo',
        payDate: '2026-07-10',
        timeIn: '10:45 AM',
        timeOut: null,
        earnCode: '',
      },
      {
        payrollName: 'Damian, Yackson Giraldo',
        payDate: '2026-07-10',
        timeIn: '03:30 PM',
        timeOut: '09:33 PM',
        earnCode: '',
      },
    ]);

    expect(result[0].payBreaks).toEqual([]);
    expect(result[0].payBreakOut).toBeNull();
    expect(result[0].payBreakIn).toBeNull();
    expect(result[0].payLogins).toEqual(['10:45', '10:45', '15:30']);
  });

  it('skips a row with no payroll name or no parseable pay date rather than crashing', () => {
    const result = groupPayrollExport([
      {
        payrollName: '',
        payDate: '2026-07-05',
        timeIn: '09:00 AM',
        timeOut: '05:00 PM',
        earnCode: '',
      },
      {
        payrollName: 'Doe, John',
        payDate: '',
        timeIn: '09:00 AM',
        timeOut: '05:00 PM',
        earnCode: '',
      },
    ]);

    expect(result).toHaveLength(0);
  });

  it('sorts out-of-order rows by Time In before grouping into breaks', () => {
    const result = groupPayrollExport([
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '05:17 PM',
        timeOut: '08:19 PM',
        earnCode: '',
      },
      {
        payrollName: 'Doe, John',
        payDate: '2026-07-05',
        timeIn: '10:45 AM',
        timeOut: '04:47 PM',
        earnCode: '',
      },
    ]);

    expect(result[0].payLogin).toBe('10:45');
    expect(result[0].payLogout).toBe('20:19');
    expect(result[0].payBreaks).toEqual([
      { breakOut: '16:47', breakIn: '17:17' },
    ]);
  });
});

describe('parsePayrollExportWorkbook', () => {
  it('parses a real-shaped .xlsx buffer into PayrollExportRow[]', async () => {
    const buffer = await buildWorkbookBuffer(
      [
        'Company Code',
        'Payroll Name',
        'File Number',
        'Pay Date',
        'Time In',
        'Time Out',
        'Hours',
        'Earnings Code',
        'Worked Department',
      ],
      [
        [
          '6WY',
          'Alarcon, Jose',
          '092006',
          new Date('2026-07-08T00:00:00.000Z'),
          '10:45 AM',
          '04:47 PM',
          6.03,
          '',
          '000004',
        ],
        [
          '6WY',
          'Alarcon, Jose',
          '092006',
          new Date('2026-07-08T00:00:00.000Z'),
          '05:17 PM',
          '08:19 PM',
          3.03,
          '',
          '000004',
        ],
      ],
    );

    const rows = await parsePayrollExportWorkbook(buffer);

    expect(rows).toHaveLength(2);
    expect(rows[0].payrollName).toBe('Alarcon, Jose');
    expect(rows[0].timeIn).toBe('10:45 AM');
    expect(rows[0].timeOut).toBe('04:47 PM');
    expect(rows[0].payDate).toBeInstanceOf(Date);

    const grouped = groupPayrollExport(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].payLogin).toBe('10:45');
    expect(grouped[0].payLogout).toBe('20:19');
  });

  it('is tolerant of column order and a trailing colon on headers', async () => {
    const buffer = await buildWorkbookBuffer(
      ['Pay Date', 'Payroll Name', 'Time Out', 'Time In', 'Earnings Code'],
      [
        [
          new Date('2026-07-08T00:00:00.000Z'),
          'Doe, John',
          '06:00 PM',
          '09:00 AM',
          'REG',
        ],
      ],
    );

    const rows = await parsePayrollExportWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0].payrollName).toBe('Doe, John');
    expect(rows[0].timeIn).toBe('09:00 AM');
    expect(rows[0].timeOut).toBe('06:00 PM');
    expect(rows[0].earnCode).toBe('REG');
  });

  it('throws a clear error when required columns are missing', async () => {
    const buffer = await buildWorkbookBuffer(
      ['Time In', 'Time Out'],
      [['09:00 AM', '06:00 PM']],
    );

    await expect(parsePayrollExportWorkbook(buffer)).rejects.toThrow(
      /missing required columns/i,
    );
  });

  it('skips rows with a blank payroll name or blank pay date', async () => {
    const buffer = await buildWorkbookBuffer(
      ['Payroll Name', 'Pay Date', 'Time In', 'Time Out'],
      [
        ['', new Date('2026-07-08T00:00:00.000Z'), '09:00 AM', '06:00 PM'],
        ['Doe, John', '', '09:00 AM', '06:00 PM'],
        [
          'Doe, John',
          new Date('2026-07-08T00:00:00.000Z'),
          '09:00 AM',
          '06:00 PM',
        ],
      ],
    );

    const rows = await parsePayrollExportWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0].payrollName).toBe('Doe, John');
  });
});
