import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class SendSqsMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9_-]+(?:\.fifo)?$/)
  queueName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  queueUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(262_144)
  body!: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  sentBy?: string;

  @IsOptional()
  @IsString()
  messageGroupId?: string; // For FIFO queues

  @IsOptional()
  @IsString()
  messageDeduplicationId?: string; // For FIFO queues

  @IsOptional()
  @IsObject()
  messageAttributes?: Record<string, { DataType: string; StringValue?: string; BinaryValue?: string }>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(900)
  delaySeconds?: number;

  @IsOptional()
  @IsEnum(['complete', 'abandon', 'deadletter', 'defer'])
  messageDisposition?: 'complete' | 'abandon' | 'deadletter' | 'defer';
}
