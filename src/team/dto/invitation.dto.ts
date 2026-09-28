import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateInvitationDto {
  @ApiProperty({ example: 'jane@company.com' })
  @Transform(lowerTrim)
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'Jane Doe',
    description: 'Pre-fills the name on the accept page',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;

  @ApiProperty({ example: 'role_default_executive' })
  @IsString()
  roleId: string;
}

export class AcceptInvitationDto {
  @ApiProperty({ example: 'Jane Doe' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
