import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import * as Joi from 'joi';
import { CommonModule } from './common/common.module';
import { AppConfigService } from './common/app-config.service';
import { MessageModule } from './messages/messages.module';
import { ServiceBusModule } from './service-bus/service-bus.module';
import { AwsSqsModule } from './aws-sqs/aws-sqs.module';
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
        MESSAGE_PROCESSING_MODE: Joi.string()
          .valid('manual', 'automatic')
          .default('manual'),
        CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
        SERVICE_BUS_CONNECTION_STRING: Joi.string().default(
          'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;UseDevelopmentEmulator=true',
        ),
        SERVICE_BUS_NAMESPACE: Joi.string().default('sbemulatorns'),
        SERVICE_BUS_QUEUE: Joi.string().default('orders-queue'),
        SERVICE_BUS_MAX_RETRIES: Joi.number().default(3),
        SERVICE_BUS_RETRY_DELAY: Joi.number().default(1000),
        MONGO_URI: Joi.string().default(
          'mongodb://testuser:testpass@localhost:27017/',
        ),
        MONGO_MESSAGE_DB: Joi.string().default('MessageTrackingDb'),
        MONGO_AUTH_SOURCE: Joi.string().default('admin'),
        THROTTLE_TTL: Joi.number().default(60),
        THROTTLE_LIMIT: Joi.number().default(60),
        AWS_SQS_ENDPOINT: Joi.string().default('http://localhost:4566'),
        AWS_REGION: Joi.string().default('us-east-1'),
        AWS_ACCESS_KEY_ID: Joi.string().default('test'),
        AWS_SECRET_ACCESS_KEY: Joi.string().default('test'),
        AWS_SQS_QUEUE_NAME: Joi.string().default('orders-queue'),
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
    ServiceBusModule,
    AwsSqsModule,
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
