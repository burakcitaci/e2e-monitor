import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ChatConversation,
  ChatConversationSchema,
} from './chat-history.schema';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryService } from './chat-history.service';
import { AwsSqsModule } from '../aws-sqs/aws-sqs.module';
import { CommonModule } from '../common/common.module';
import { MessagingChatController } from './messaging-chat.controller';
import { MessagingChatService } from './messaging-chat.service';
import { MessagingChatRuntime } from './messaging-chat.runtime';
import { MessagingChatToolsService } from './messaging-chat-tools.service';

@Module({
  imports: [
    CommonModule,
    AwsSqsModule,
    MongooseModule.forFeature(
      [{ name: ChatConversation.name, schema: ChatConversationSchema }],
      'MessageTrackingDb',
    ),
  ],
  controllers: [MessagingChatController, ChatHistoryController],
  providers: [
    ChatHistoryService,
    MessagingChatRuntime,
    MessagingChatService,
    MessagingChatToolsService,
  ],
})
export class MessagingChatModule {}
