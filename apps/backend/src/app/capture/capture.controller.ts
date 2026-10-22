import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaptureEventDto } from './capture-event.dto';
import { CaptureService } from './capture.service';

@Controller('events')
export class CaptureController {
  constructor(
    private readonly capture: CaptureService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async ingest(
    @Headers('authorization') authorization: string | undefined,
    @Body() event: CaptureEventDto,
  ) {
    const token =
      this.config.get<string>('CAPTURE_TOKEN') || 'local-capture-token';
    if (authorization !== `Bearer ${token}`)
      throw new UnauthorizedException('Invalid capture token');
    return { success: true, data: await this.capture.ingest(event) };
  }
}
