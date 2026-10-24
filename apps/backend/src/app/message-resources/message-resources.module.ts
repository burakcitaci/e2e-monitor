import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageResourcesService } from './message-resources.service';
import { MessageResourcesController } from './message-resources.controller';
import {
  MessagingResource,
  MessagingResourceSchema,
} from './message-resources.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: MessagingResource.name, schema: MessagingResourceSchema }],
      'MessageTrackingDb', // Specify the connection name
    ),
  ],
  controllers: [MessageResourcesController],
  providers: [MessageResourcesService],
  exports: [MessageResourcesService],
})
export class MessageResourcesModule {}
