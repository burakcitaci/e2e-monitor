import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { DemoOutcome, ScenarioPolicy } from '@e2e-monitor/entities';

export class ScenarioPolicyDto implements ScenarioPolicy {
  @IsString() @IsNotEmpty() @MaxLength(100) publisher!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) consumer!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) messageType!: string;
  @IsIn(['sqs', 'azure-service-bus']) provider!: ScenarioPolicy['provider'];
  @IsString() @IsNotEmpty() @MaxLength(260) destination!: string;
  @IsInt() @Min(1) @Max(3600) timeoutSeconds!: number;
}

export class CreateScenarioDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ScenarioPolicyDto)
  policy!: ScenarioPolicyDto;
}

export class StartDemoRunDto {
  @IsIn(['pass', 'fail', 'timeout']) outcome!: DemoOutcome;
}
