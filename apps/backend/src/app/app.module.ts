import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/configuration.module';
import { DatabaseModule } from './database/database.module';
import { HttpModule } from './common/http/http.module';
import { MessageModule } from './messages/messages.module';
import { MessageResourcesModule } from './message-resources/message-resources.module';
import { MessagingChatModule } from './messaging-chat/messaging-chat.module';
import { PoliciesModule } from './policies/policies.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    HttpModule,
    MessageModule,
    MessageResourcesModule,
    MessagingChatModule,
    PoliciesModule,
    HealthModule,
  ],
})
export class AppModule {}
