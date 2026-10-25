import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Provider, ResourceType } from '../message-resources.schema';

export class CreateMessageResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(260)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}$/, { each: true })
  subscriptions?: string[];

  @IsEnum(Provider)
  provider!: Provider;

  @IsEnum(ResourceType)
  type!: ResourceType;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
