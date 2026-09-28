import { parseBreakReport, parseBreakReportCsv } from './breakReport';

const REAL_SHAPED_CSV = [
  ',,,,,,',
  'DA Break Utilization,,,,,,',
  ',,,,,,',
  'Note:,,,,,,',
  '"Breaks recorded in the Amazon Delivery App.",,,,,,',
  ',,,,,,',
  'DSP:,BLEF,,,,,',
  'Station:,DJZ2,,,,,',
  'Date:,2026-07-05,,,,,',
  'Heat tier:,No Weather Reduction,,,,,',
  'Planned Break Time (mins):,60,60 base + 0 weather adjustment,,,,',
  'DA Transporter ID:,DA Name:,Break Start Time,Break End Time,Break Duration in Minutes,Report Source,Break Type',
  'A2TFXMI755J20N,Dianed Correa-Troche,,,0,Unplanned Stops,',
  'A1J3WZSILPRLSL,Yasmany Gomez Jorge,15:02:09,15:31:49,29,Delivery App,REST',
  'A28ODHGVTWHQPI,Jose Espinoza Johnson,14:05:26,14:34:58,29,Delivery App,REST',
].join('\n');

describe('parseBreakReport', () => {
  it('parses a real-shaped Delivery App row into a break segment', () => {
    const result = parseBreakReport(
      [
        {
          daName: 'Yasmany Gomez Jorge',
          breakStartTime: '15:02:09',
          breakEndTime: '15:31:49',
          reportSource: 'Delivery App',
        },
      ],
      '2026-07-05',
    );

    expect(result).toHaveLength(1);
    expect(result[0].amazonName).toBe('Yasmany Gomez Jorge');
    expect(result[0].date).toBe('2026-07-05');
    expect(result[0].segments).toEqual([
      { breakOut: '15:02', breakIn: '15:31' },
    ]);
  });

  it('excludes "Unplanned Stops" rows even if they somehow have real-looking times', () => {
    const result = parseBreakReport(
      [
        {
          daName: 'Dianed Correa-Troche',
          breakStartTime: null,
          breakEndTime: null,
          reportSource: 'Unplanned Stops',
        },
        {
          daName: 'Robert Fernandez',
          breakStartTime: '10:00',
          breakEndTime: '10:12',
          reportSource: 'Unplanned Stops',
        },
      ],
      '2026-07-08',
    );

    expect(result).toHaveLength(0);
  });

  it('skips a row with a blank DA Name, matching the real Day1 data', () => {
    const result = parseBreakReport(
      [
        {
          daName: '',
          breakStartTime: '16:31',
          breakEndTime: '17:01',
          reportSource: 'Delivery App',
        },
      ],
      '2026-07-05',
    );

    expect(result).toHaveLength(0);
  });

  it('groups multiple Delivery App segments for the same driver into one array', () => {
    const result = parseBreakReport(
      [
        {
          daName: 'Doe, John',
          breakStartTime: '10:00',
          breakEndTime: '10:05',
          reportSource: 'Delivery App',
        },
        {
          daName: 'Doe, John',
          breakStartTime: '14:00',
          breakEndTime: '14:05',
          reportSource: 'Delivery App',
        },
      ],
      '2026-07-05',
    );

    expect(result).toHaveLength(1);
    expect(result[0].segments).toHaveLength(2);
  });

  it('is case-insensitive on the Report Source filter', () => {
    const result = parseBreakReport(
      [
        {
          daName: 'Doe, John',
          breakStartTime: '10:00',
          breakEndTime: '10:05',
          reportSource: 'delivery app',
        },
      ],
      '2026-07-05',
    );

    expect(result).toHaveLength(1);
  });
});

describe('parseBreakReportCsv', () => {
  it('extracts the metadata date and the header-row-mapped data rows from a real-shaped export', () => {
    const { rows, date } = parseBreakReportCsv(Buffer.from(REAL_SHAPED_CSV));

    expect(date).toBe('2026-07-05');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      daName: 'Dianed Correa-Troche',
      breakStartTime: '',
      breakEndTime: '',
      reportSource: 'Unplanned Stops',
    });
    expect(rows[1]).toEqual({
      daName: 'Yasmany Gomez Jorge',
      breakStartTime: '15:02:09',
      breakEndTime: '15:31:49',
      reportSource: 'Delivery App',
    });

    const parsed = parseBreakReport(rows, date ?? 'unknown');
    expect(parsed).toHaveLength(2);
    expect(parsed.map((p) => p.amazonName)).toEqual([
      'Yasmany Gomez Jorge',
      'Jose Espinoza Johnson',
    ]);
  });

  it('skips a row whose DA Name column is blank', () => {
    const csv = [
      'Date:,2026-07-05,,,,,',
      'DA Transporter ID:,DA Name:,Break Start Time,Break End Time,Break Duration in Minutes,Report Source,Break Type',
      'A123,,15:02:09,15:31:49,29,Delivery App,REST',
      'A456,Doe John,15:02:09,15:31:49,29,Delivery App,REST',
    ].join('\n');

    const { rows } = parseBreakReportCsv(Buffer.from(csv));

    expect(rows).toHaveLength(1);
    expect(rows[0].daName).toBe('Doe John');
  });

  it('throws a clear error when the header row can never be found', () => {
    const csv = ['Date:,2026-07-05,,,,,', 'nothing,useful,here'].join('\n');

    expect(() => parseBreakReportCsv(Buffer.from(csv))).toThrow(
      /missing required column/i,
    );
  });

  it('returns a null date when no Date: metadata line is present', () => {
    const csv = [
      'DA Transporter ID:,DA Name:,Break Start Time,Break End Time,Break Duration in Minutes,Report Source,Break Type',
      'A456,Doe John,15:02:09,15:31:49,29,Delivery App,REST',
    ].join('\n');

    const { date } = parseBreakReportCsv(Buffer.from(csv));

    expect(date).toBeNull();
  });
});
