import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ChatConversation,
  ChatConversationSchema,
} from './chat-history.schema';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryService } from './chat-history.service';
import { MessageResourcesModule } from '../message-resources/message-resources.module';
import { CommonModule } from '../common/common.module';
import { MessagingChatController } from './messaging-chat.controller';
import { MessagingChatService } from './messaging-chat.service';
import { MessagingChatRuntime } from './messaging-chat.runtime';
import { MessagingChatToolsService } from './messaging-chat-tools.service';
import { MessagingChatKnowledgeService } from './messaging-chat-knowledge.service';
import { CaptureModule } from '../capture/capture.module';

@Module({
  imports: [
    CommonModule,
    MessageResourcesModule,
    CaptureModule,
    MongooseModule.forFeature(
      [{ name: ChatConversation.name, schema: ChatConversationSchema }],
      'MessageTrackingDb',
    ),
  ],
  controllers: [MessagingChatController, ChatHistoryController],
  providers: [
    MessagingChatKnowledgeService,
    ChatHistoryService,
    MessagingChatRuntime,
    MessagingChatService,
    MessagingChatToolsService,
  ],
})
export class MessagingChatModule {}
