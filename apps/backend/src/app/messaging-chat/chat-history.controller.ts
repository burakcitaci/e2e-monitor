import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';
import {
  AppendChatTurnDto,
  ChatHistoryQueryDto,
  CreateChatDto,
} from './chat-history.dto';

@Controller('messaging-chat/conversations')
export class ChatHistoryController {
  constructor(private readonly history: ChatHistoryService) {}
  @Get() async list(@Query() query: ChatHistoryQueryDto) {
    return { success: true, data: await this.history.list(query.page) };
  }
  @Get(':id') async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { success: true, data: await this.history.get(id) };
  }
  @Post() async create(@Body() input: CreateChatDto) {
    return { success: true, data: await this.history.create(input) };
  }
  @Post(':id/turns') async append(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: AppendChatTurnDto,
  ) {
    return { success: true, data: await this.history.append(id, input) };
  }
}
