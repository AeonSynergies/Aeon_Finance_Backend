import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PermissionInputDto } from './permission-input.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoleDto {
  @ApiProperty({ example: 'Payroll Reviewer' })
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  name: string;

  @ApiPropertyOptional({ example: 'Reviews validated rows; cannot approve.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    type: [PermissionInputDto],
    description:
      'Modules left out get no access (on create) or stay unchanged (on update).',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique((p: PermissionInputDto) => p.module, {
    message: 'Each module may appear only once',
  })
  @ValidateNested({ each: true })
  @Type(() => PermissionInputDto)
  permissions?: PermissionInputDto[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
