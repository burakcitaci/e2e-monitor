import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { ChatTurn } from '@e2e-monitor/entities';

class ChatTurnDto implements ChatTurn {
  @IsIn(['user', 'assistant']) role!: ChatTurn['role'];
  @IsString() @IsNotEmpty() @MaxLength(16000) content!: string;
}

export class MessagingChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  messages!: ChatTurnDto[];
}
