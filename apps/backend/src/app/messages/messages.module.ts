import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './messages.service';
import { LoggingModule } from '../common/logging/logging.module';
import { TrackingMessage, TrackingMessageSchema } from './message.schema';
import { MessagesController } from './messages.controller';
import { CaptureModule } from '../capture/capture.module';

@Module({
  imports: [
    CaptureModule,
    LoggingModule,
    MongooseModule.forFeature(
      [{ name: TrackingMessage.name, schema: TrackingMessageSchema }],
      'MessageTrackingDb', // Specify the connection name
    ),
  ],
  controllers: [MessagesController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
