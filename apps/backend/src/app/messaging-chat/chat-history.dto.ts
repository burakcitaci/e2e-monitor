import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import type { ChatMode, SavedChatTurn } from '@e2e-monitor/entities';

export class CreateChatDto {
  @IsUUID('4') id!: string;
  @IsIn(['structured', 'tools']) mode!: ChatMode;
}
class SavedTurnDto implements SavedChatTurn {
  @IsUUID('4') id!: string;
  @IsIn(['user', 'assistant']) role!: SavedChatTurn['role'];
  @IsString() @IsNotEmpty() @MaxLength(16000) content!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(20000)
  context?: string;
}
export class AppendChatTurnDto {
  @IsInt() @Min(0) @Max(200) revision!: number;
  @IsObject()
  @ValidateNested()
  @Type(() => SavedTurnDto)
  @IsNotEmpty()
  turn!: SavedTurnDto;
}
export class ChatHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}
