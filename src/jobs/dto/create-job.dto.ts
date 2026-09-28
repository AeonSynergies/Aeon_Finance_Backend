import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';
import { IsOnOrAfter } from '../../common/validators/is-on-or-after.validator';

const FREQUENCIES = ['DAILY', 'WEEKLY', 'BIWEEKLY'] as const;

export class CreateJobDto {
  @ApiProperty({ example: 'WEEKLY', enum: FREQUENCIES })
  @IsIn(FREQUENCIES)
  frequency: (typeof FREQUENCIES)[number];

  @ApiProperty({ example: '2026-07-05' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-07-11' })
  @IsDateString()
  @IsOnOrAfter('periodStart', {
    message: 'periodEnd must be on or after periodStart',
  })
  periodEnd: string;

  @ApiProperty({ example: '2026-07-14' })
  @IsDateString()
  @IsOnOrAfter('periodEnd', {
    message: 'processDate must be on or after periodEnd',
  })
  processDate: string;
}
