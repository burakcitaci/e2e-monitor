import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Provider, ResourceType } from '../message-resources.schema';
import { ArrayMaxSize, ArrayUnique, IsArray, Matches } from 'class-validator';

export class UpdateMessageResourceDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}$/, { each: true })
  subscriptions?: string[];
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Provider)
  provider?: Provider;

  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
