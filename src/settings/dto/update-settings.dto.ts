import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  waveLoginBufferMins?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amazonLoginBufferMins?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  physicalLoginBufferMins?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mealBreakBufferMins?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  logoutBufferMins?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amazonAutoLogoutEstimateBufferMins?: number;

  @ApiPropertyOptional({ example: ['PTO'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ptoEarnCodes?: string[];

  @ApiPropertyOptional({ example: ['BON', 'BNH'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  bonusEarnCodes?: string[];

  @ApiPropertyOptional({ example: ['TRN'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  trainingEarnCodes?: string[];

  @ApiPropertyOptional({ example: ['VTO'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  vtoEarnCodes?: string[];

  @ApiPropertyOptional({ example: 0.75 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  fuzzyAmazonMatchThreshold?: number;

  @ApiPropertyOptional({ example: 0.6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  fuzzyBreakReportMatchThreshold?: number;

  @ApiPropertyOptional({ example: ['CA', 'TX'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mealWaiverExemptStates?: string[];
}
