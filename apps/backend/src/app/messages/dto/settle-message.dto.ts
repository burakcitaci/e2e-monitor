import { IsIn } from 'class-validator';
import {
  messageDispositions,
  type MessageDisposition,
} from '../message.schema';

export class SettleMessageDto {
  @IsIn(messageDispositions)
  disposition!: MessageDisposition;
}
