import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { UploadDocType } from '@prisma/client';

export class UploadFileDto {
  @ApiProperty({ enum: UploadDocType, example: UploadDocType.PAYROLL_TIMECARD })
  @IsEnum(UploadDocType)
  docType: UploadDocType;

  @ApiProperty({
    example: '2026-07-08',
    required: false,
    description:
      'Required for AMAZON_ACTIVITY (Amazon Itinerary) uploads, since the file itself has no date column. Ignored for other doc types.',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
