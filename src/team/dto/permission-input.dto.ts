import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionModule } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class PermissionInputDto {
  @ApiProperty({ enum: PermissionModule, example: 'JOBS' })
  @IsEnum(PermissionModule)
  module: PermissionModule;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Implies read' })
  @IsOptional()
  @IsBoolean()
  write?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Implies read' })
  @IsOptional()
  @IsBoolean()
  edit?: boolean;
}
