import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OverrideRowDto {
  @ApiProperty({ example: 'GOOD_NO_ERROR' })
  @IsString()
  @IsNotEmpty()
  newStatus: string;

  @ApiProperty({
    example: 'Driver provided a valid explanation verified by Dispatch.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    required: false,
    example: 'Confirmed with dispatcher on call.',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
