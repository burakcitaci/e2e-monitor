import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { MessageService } from './messages.service';
import { EmulatorType, emulatorTypes } from './message.schema';
import { AppLogger } from '../common/logging/logger.service';
import { CaptureService } from '../capture/capture.service';
import { isValidObjectId } from 'mongoose';
import {
  CreateTrackingMessageDto,
  UpdateTrackingMessageDto,
} from './dto/tracking-message.dto';

@Controller('tracked-messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessageService,
    private readonly logger: AppLogger,
    private readonly capture: CaptureService,
  ) {
    this.logger.setContext(MessagesController.name);
  }

  @Get('tracking')
  async getTrackingMessages() {
    const [history, captured] = await Promise.all([
      this.messagesService.findTrackingMessages(),
      this.capture.trackingRows(),
    ]);
    const result = [...history, ...captured].sort(
      (a, b) =>
        new Date(b.sentAt ?? 0).getTime() - new Date(a.sentAt ?? 0).getTime(),
    );
    this.logger.log(`Retrieved ${result.length} tracking messages`);
    return {
      success: true,
      data: result,
    };
  }
  @Get('tracking/emulator/:emulator')
  async getTrackingMessagesByEmulator(@Param('emulator') emulator: string) {
    if (!emulatorTypes.includes(emulator as EmulatorType)) {
      throw new BadRequestException(`Unsupported emulator type: ${emulator}`);
    }
    const [history, captured] = await Promise.all([
      this.messagesService.findTrackingMessagesByEmulator(
        emulator as EmulatorType,
      ),
      this.capture
        .trackingRows()
        .then((rows) => rows.filter((row) => row.emulatorType === emulator)),
    ]);
    const result = [...history, ...captured].sort(
      (a, b) =>
        new Date(b.sentAt ?? 0).getTime() - new Date(a.sentAt ?? 0).getTime(),
    );
    this.logger.log(
      `Retrieved ${result.length} tracking messages for emulator ${emulator}`,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get('tracking/:id')
  async getTrackingMessage(@Param('id') id: string) {
    const result = /^[a-f0-9]{64}$/.test(id)
      ? await this.capture.detail(id)
      : isValidObjectId(id)
        ? await this.messagesService.findOneTracking(id)
        : null;
    if (!result) throw new NotFoundException('Message not found');
    this.logger.log(`Retrieved tracking message ${id}`);
    return {
      success: true,
      data: result,
    };
  }

  @Post('tracking')
  async createTrackingMessage(@Body() message: CreateTrackingMessageDto) {
    const result = await this.messagesService.createTracking({
      ...message,
      sentAt: new Date(message.sentAt),
    });
    this.logger.log(`Created tracking message ${result.messageId}`);
    return {
      success: true,
      data: result,
    };
  }

  @Put('tracking/:id')
  async updateTrackingMessage(
    @Param('id') id: string,
    @Body() message: UpdateTrackingMessageDto,
  ) {
    const result = await this.messagesService.updateTracking(id, {
      ...message,
      receivedAt: message.receivedAt ? new Date(message.receivedAt) : undefined,
    });
    this.logger.log(`Updated tracking message ${id}`);
    return {
      success: true,
      data: result,
    };
  }

  @Delete('tracking/:id')
  async deleteTrackingMessage(@Param('id') id: string) {
    await this.messagesService.removeTracking(id);
    this.logger.log(`Deleted tracking message ${id}`);
    return {
      success: true,
      message: 'Tracking message deleted successfully',
    };
  }
}
