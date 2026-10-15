import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { MessageService } from './messages.service';
import { PendingDeliveriesService } from './pending-deliveries.service';
import { SettleMessageDto } from './dto/settle-message.dto';
import { EmulatorType, emulatorTypes } from './message.schema';
import { AppLogger } from '../common/logger.service';
import {
  CreateTrackingMessageDto,
  UpdateTrackingMessageDto,
} from './dto/tracking-message.dto';

@Controller('tracked-messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessageService,
    private readonly logger: AppLogger,
    private readonly pendingDeliveries: PendingDeliveriesService,
  ) {
    this.logger.setContext(MessagesController.name);
  }

  @Get('tracking')
  async getTrackingMessages() {
    const result = await this.messagesService.findTrackingMessages();
    this.logger.log(`Retrieved ${result.length} tracking messages`);
    return {
      success: true,
      data: result.map((message) => ({
        ...message,
        pendingDeliveries: this.pendingDeliveries.list(
          String((message as { _id?: unknown })._id),
        ),
      })),
    };
  }
  @Get('tracking/emulator/:emulator')
  async getTrackingMessagesByEmulator(@Param('emulator') emulator: string) {
    if (!emulatorTypes.includes(emulator as EmulatorType)) {
      throw new BadRequestException(`Unsupported emulator type: ${emulator}`);
    }
    const result = await this.messagesService.findTrackingMessagesByEmulator(
      emulator as EmulatorType,
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
    const result = await this.messagesService.findOneTracking(id);
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

  @Post('tracking/:id/settle/:token')
  async settleMessage(
    @Param('id') id: string,
    @Param('token') token: string,
    @Body() dto: SettleMessageDto,
  ) {
    return {
      success: true,
      data: await this.pendingDeliveries.settle(id, token, dto.disposition),
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
