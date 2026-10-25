import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageResourcesService } from './message-resources.service';
import { MessageResourcesController } from './message-resources.controller';
import { BrokerProvisionerService } from './broker-provisioner.service';
import { ConfigurationModule } from '../config/configuration.module';
import {
  MessagingResource,
  MessagingResourceSchema,
} from './message-resources.schema';

@Module({
  imports: [
    ConfigurationModule,
    MongooseModule.forFeature(
      [{ name: MessagingResource.name, schema: MessagingResourceSchema }],
      'MessageTrackingDb', // Specify the connection name
    ),
  ],
  controllers: [MessageResourcesController],
  providers: [MessageResourcesService, BrokerProvisionerService],
  exports: [MessageResourcesService],
})
export class MessageResourcesModule {}
