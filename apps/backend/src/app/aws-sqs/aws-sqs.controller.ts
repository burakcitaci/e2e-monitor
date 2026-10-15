import { Body, Controller, Get, Post } from '@nestjs/common';
import { SendSqsMessageDto } from './dto/send-sqs-message.dto';
import { ReceiveSqsMessageDto } from './dto/receive-sqs-message.dto';
import { AwsSqsService } from './aws-sqs.service';
import { AppConfigService } from '../common/app-config.service';

@Controller('aws-sqs')
export class AwsSqsController {
  constructor(
    private readonly awsSqsService: AwsSqsService,
    private readonly config: AppConfigService,
  ) {}

  @Post('messages')
  async sendMessage(@Body() dto: SendSqsMessageDto) {
    const result = await this.awsSqsService.sendMessage(dto);
    return {
      success: true,
      message: 'Message enqueued successfully',
      data: result,
    };
  }

  @Get('queues')
  async listQueues() {
    return { success: true, data: await this.awsSqsService.listQueueResources() };
  }

  @Get('messages')
  async getMessages() {
    const result = await this.awsSqsService.getMessages();
    return {
      success: true,
      data: result,
    };
  }

  @Post('messages/receive')
  async receiveMessage(@Body() dto: ReceiveSqsMessageDto) {
    const result = await this.awsSqsService.receiveMessage(dto);
    return result;
  }

  @Get('config')
  getConfiguration() {
    return {
      success: true,
      data: this.config.getAwsSqsConfiguration(),
    };
  }
}

