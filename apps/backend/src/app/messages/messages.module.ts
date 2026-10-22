import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './messages.service';
import { CommonModule } from '../common/common.module';
import { TrackingMessage, TrackingMessageSchema } from './message.schema';
import { MessagesController } from './messages.controller';
import { PendingDeliveriesService } from './pending-deliveries.service';
import { CaptureModule } from '../capture/capture.module';

@Module({
  imports: [
    CaptureModule,
    CommonModule,
    MongooseModule.forFeature(
      [{ name: TrackingMessage.name, schema: TrackingMessageSchema }],
      'MessageTrackingDb', // Specify the connection name
    ),
  ],
  controllers: [MessagesController],
  providers: [MessageService, PendingDeliveriesService],
  exports: [MessageService, PendingDeliveriesService],
})
export class MessageModule {}
