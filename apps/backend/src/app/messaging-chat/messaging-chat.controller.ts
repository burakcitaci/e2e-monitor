import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MessagingChatService } from './messaging-chat.service';
import { MessagingChatDto } from './messaging-chat.dto';

@Controller('messaging-chat')
export class MessagingChatController {
  constructor(private readonly service: MessagingChatService) {}
  @Get('status') getStatus() {
    return { success: true, data: this.service.getStatus() };
  }
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('messages')
  async reply(@Body() dto: MessagingChatDto) {
    return { success: true, data: await this.service.reply(dto.messages) };
  }
}
