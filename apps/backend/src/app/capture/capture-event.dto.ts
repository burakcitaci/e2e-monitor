import {
  Equals,
  IsDateString,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CaptureEventDto {
  @Equals(1)
  schemaVersion!: number;

  @IsUUID()
  eventId!: string;

  @IsUUID()
  captureId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  messageId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  namespace!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  destination!: string;

  @IsIn(['sent', 'received', 'completed'])
  type!: 'sent' | 'received' | 'completed';

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  service!: string;

  @IsDateString({ strict: true })
  occurredAt!: string;

  @ValidateIf(
    (event: CaptureEventDto) =>
      event.type !== 'sent' || event.subscription !== undefined,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  subscription?: string;

  @ValidateIf(
    (event: CaptureEventDto) =>
      event.type === 'sent' || event.body !== undefined,
  )
  @IsString()
  @MaxLength(100_000)
  body?: string;
}
