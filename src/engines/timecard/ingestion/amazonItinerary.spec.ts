import { Workbook } from 'exceljs';
import {
  parseAmazonItinerary,
  parseAmazonItineraryWorkbook,
} from './amazonItinerary';

async function buildWorkbookBuffer(
  headers: string[],
  rows: (string | number)[][],
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Itineraries');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

describe('parseAmazonItinerary', () => {
  it('parses a real-shaped row, converting times and attaching the supplied date', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Yackson,Giraldo Damian',
          appSignIn: '10:58am',
          appSignOut: '9:25pm',
          lastStopExecutionTime: '8:55pm',
        },
      ],
      '2026-07-05',
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      amazonName: 'Yackson,Giraldo Damian',
      date: '2026-07-05',
      appLogin: '10:58',
      appLogout: '21:25',
      lastStop: '20:55',
    });
  });

  it('treats the literal "Missing" placeholder as null for any field', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Doe, John',
          appSignIn: 'Missing',
          appSignOut: '9:25pm',
          lastStopExecutionTime: 'Missing',
        },
      ],
      '2026-07-05',
    );

    expect(result[0].appLogin).toBeNull();
    expect(result[0].appLogout).toBe('21:25');
    expect(result[0].lastStop).toBeNull();
  });

  it('skips a row with no driver name (or "Missing" as the name) rather than crashing', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: null,
          appSignIn: '10:58am',
          appSignOut: '9:25pm',
          lastStopExecutionTime: '8:55pm',
        },
        {
          driverName: 'Missing',
          appSignIn: '10:58am',
          appSignOut: '9:25pm',
          lastStopExecutionTime: '8:55pm',
        },
      ],
      '2026-07-05',
    );

    expect(result).toHaveLength(0);
  });

  it('treats a date-prefixed sign-out showing the wrong date as broken/missing (Q8), the real example found in sample Itinerary data', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Joel,Portorreal Ortiz',
          appSignIn: '10:56am',
          appSignOut: 'Jul 7 3:08am',
          lastStopExecutionTime: '8:44pm',
        },
      ],
      '2026-07-06',
    );

    expect(result[0].appLogout).toBeNull();
  });

  it('treats a date-prefixed sign-out on the correct date but before 6:00 AM as broken/missing (Q8)', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Miguel,Feliz Rivera',
          appSignIn: '10:56am',
          appSignOut: 'Jul 5 3:56am',
          lastStopExecutionTime: '8:44pm',
        },
      ],
      '2026-07-05',
    );

    expect(result[0].appLogout).toBeNull();
  });

  it('correctly parses a date-prefixed sign-out that matches the shift date and is a plausible hour', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Doe, John',
          appSignIn: '10:56am',
          appSignOut: 'Jul 5 11:08pm',
          lastStopExecutionTime: '8:44pm',
        },
      ],
      '2026-07-05',
    );

    expect(result[0].appLogout).toBe('23:08');
  });

  it('treats a plain (non-date-prefixed) sign-out before 6:00 AM as broken/missing too (Q8: either condition alone is enough)', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Doe, John',
          appSignIn: '10:56am',
          appSignOut: '3:08am',
          lastStopExecutionTime: '8:44pm',
        },
      ],
      '2026-07-05',
    );

    expect(result[0].appLogout).toBeNull();
  });

  it('does not flag a plain sign-out exactly at the 6:00 AM boundary', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Doe, John',
          appSignIn: '10:56am',
          appSignOut: '6:00am',
          lastStopExecutionTime: '8:44pm',
        },
      ],
      '2026-07-05',
    );

    expect(result[0].appLogout).toBe('06:00');
  });

  it('produces one record per row for a multi-driver daily file', () => {
    const result = parseAmazonItinerary(
      [
        {
          driverName: 'Doe, John',
          appSignIn: '10:58am',
          appSignOut: '9:25pm',
          lastStopExecutionTime: '8:55pm',
        },
        {
          driverName: 'Smith, Jane',
          appSignIn: '10:56am',
          appSignOut: '9:26pm',
          lastStopExecutionTime: '8:43pm',
        },
      ],
      '2026-07-05',
    );

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.amazonName)).toEqual([
      'Doe, John',
      'Smith, Jane',
    ]);
  });
});

describe('parseAmazonItineraryWorkbook', () => {
  it('parses a real-shaped .xlsx buffer, including the trailing-colon headers', async () => {
    const buffer = await buildWorkbookBuffer(
      [
        'Transporter Id',
        'Driver name',
        'DSP',
        'App sign in:',
        'App sign out:',
        'Last stop execution time',
      ],
      [
        [
          'A1MJRGFX0W1XD5',
          'Yackson,Giraldo Damian',
          'BLUE LEAF LOGISTICS LLC',
          '10:58am',
          '9:25pm',
          '8:55pm',
        ],
      ],
    );

    const rows = await parseAmazonItineraryWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      driverName: 'Yackson,Giraldo Damian',
      appSignIn: '10:58am',
      appSignOut: '9:25pm',
      lastStopExecutionTime: '8:55pm',
    });

    const parsed = parseAmazonItinerary(rows, '2026-07-05');
    expect(parsed[0].appLogin).toBe('10:58');
    expect(parsed[0].appLogout).toBe('21:25');
  });

  it('throws a clear error when the Driver name column is missing', async () => {
    const buffer = await buildWorkbookBuffer(
      ['App sign in:', 'App sign out:'],
      [['10:58am', '9:25pm']],
    );

    await expect(parseAmazonItineraryWorkbook(buffer)).rejects.toThrow(
      /missing required column/i,
    );
  });

  it('skips rows with a blank driver name', async () => {
    const buffer = await buildWorkbookBuffer(
      ['Driver name', 'App sign in:', 'App sign out:'],
      [
        ['', '10:58am', '9:25pm'],
        ['Doe, John', '09:00am', '06:00pm'],
      ],
    );

    const rows = await parseAmazonItineraryWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0].driverName).toBe('Doe, John');
  });
});
