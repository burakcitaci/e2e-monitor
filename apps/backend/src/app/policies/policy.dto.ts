import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PolicyHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([15, 30, 60, 240, 1440, 10080, 43200])
  minutes?: number;
}

export class CreatePolicyDto {
  @IsString() name!: string;
  @IsIn(['azure', 'aws']) provider!: 'azure' | 'aws';
  @IsOptional() @IsString() namespace?: string;
  @IsString() sourceService!: string;
  @IsString() destinationService!: string;
  @IsString() destination!: string;
  @IsString() subscription!: string;
  @Type(() => Number) @IsNumber() @Min(0.001) thresholdSeconds!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  requiredSuccessPercentage?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  evaluationWindowMinutes?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minimumSampleCount?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdatePolicyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['azure', 'aws']) provider?: 'azure' | 'aws';
  @IsOptional() @IsString() namespace?: string;
  @IsOptional() @IsString() sourceService?: string;
  @IsOptional() @IsString() destinationService?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() subscription?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  thresholdSeconds?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  requiredSuccessPercentage?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  evaluationWindowMinutes?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minimumSampleCount?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
