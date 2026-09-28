import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateJobDto } from './create-job.dto';

async function validateDto(data: Partial<CreateJobDto>) {
  const dto = plainToInstance(CreateJobDto, data);
  return validate(dto);
}

describe('CreateJobDto', () => {
  it('passes validation for a valid weekly job', async () => {
    const errors = await validateDto({
      frequency: 'WEEKLY',
      periodStart: '2026-07-05',
      periodEnd: '2026-07-11',
      processDate: '2026-07-14',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects periodEnd before periodStart', async () => {
    const errors = await validateDto({
      frequency: 'WEEKLY',
      periodStart: '2026-08-01',
      periodEnd: '2026-07-01',
      processDate: '2026-08-05',
    });
    const periodEndError = errors.find((e) => e.property === 'periodEnd');
    expect(periodEndError).toBeDefined();
  });

  it('accepts periodEnd equal to periodStart (a valid single-day period)', async () => {
    const errors = await validateDto({
      frequency: 'DAILY',
      periodStart: '2026-07-06',
      periodEnd: '2026-07-06',
      processDate: '2026-07-07',
    });
    expect(errors.find((e) => e.property === 'periodEnd')).toBeUndefined();
  });

  it('rejects processDate before periodEnd', async () => {
    const errors = await validateDto({
      frequency: 'WEEKLY',
      periodStart: '2026-07-05',
      periodEnd: '2026-07-11',
      processDate: '2026-07-01',
    });
    const processDateError = errors.find((e) => e.property === 'processDate');
    expect(processDateError).toBeDefined();
  });

  it('accepts processDate equal to periodEnd', async () => {
    const errors = await validateDto({
      frequency: 'WEEKLY',
      periodStart: '2026-07-05',
      periodEnd: '2026-07-11',
      processDate: '2026-07-11',
    });
    expect(errors.find((e) => e.property === 'processDate')).toBeUndefined();
  });
});
