import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
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

export class CreateMemberDto {
  @ApiProperty({ example: 'Jane Doe' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({ example: 'jane@company.com' })
  @Transform(lowerTrim)
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'a-strong-password',
    description: 'Initial password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'role_default_executive' })
  @IsString()
  roleId: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;

  @ApiPropertyOptional({ example: 'role_default_manager' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Deactivated members can no longer sign in',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
