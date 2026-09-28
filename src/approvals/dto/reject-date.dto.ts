import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectDateDto {
  @ApiProperty({
    example:
      'Break times do not match Amazon data; please verify with the driver.',
  })
  @IsString()
  @IsNotEmpty()
  rejectionComments: string;
}
