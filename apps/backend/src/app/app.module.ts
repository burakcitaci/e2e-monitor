import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import * as Joi from 'joi';
import { CommonModule } from './common/common.module';
import { AppConfigService } from './common/app-config.service';
import { MessageModule } from './messages/messages.module';
import { HealthModule } from './health/health.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { MessageResourcesModule } from './message-resources/message-resources.module';
import { MessagingChatModule } from './messaging-chat/messaging-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        GEMINI_API_KEY: Joi.string().allow('').default(''),
        GEMINI_MODEL: Joi.string().default('gemini-3.5-flash-lite'),
        CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
        MONGO_URI: Joi.string().default(
          'mongodb://testuser:testpass@localhost:27017/',
        ),
        MONGO_MESSAGE_DB: Joi.string().default('MessageTrackingDb'),
        MONGO_AUTH_SOURCE: Joi.string().default('admin'),
        THROTTLE_TTL: Joi.number().default(60),
        THROTTLE_LIMIT: Joi.number().default(60),
      }),
    }),
    CommonModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        {
          ttl: config.throttleTtl,
          limit: config.throttleLimit,
        },
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.mongoUri,
        dbName: config.mongoTrackingDbName,
        authSource: config.mongoAuthSource,
      }),
      connectionName: 'MessageTrackingDb',
    }),
    MessageModule,
    MessageResourcesModule,
    MessagingChatModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
