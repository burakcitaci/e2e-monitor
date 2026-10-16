import { Module } from '@nestjs/common';
import { AwsSqsModule } from '../aws-sqs/aws-sqs.module';
import { CommonModule } from '../common/common.module';
import { MessagingChatController } from './messaging-chat.controller';
import { MessagingChatService } from './messaging-chat.service';
import { MessagingChatRuntime } from './messaging-chat.runtime';
import { MessagingChatToolsService } from './messaging-chat-tools.service';

@Module({
  imports: [CommonModule, AwsSqsModule],
  controllers: [MessagingChatController],
  providers: [
    MessagingChatRuntime,
    MessagingChatService,
    MessagingChatToolsService,
  ],
})
export class MessagingChatModule {}
