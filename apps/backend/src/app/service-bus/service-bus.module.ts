import { Module } from '@nestjs/common';
import { ServiceBusClient } from '@azure/service-bus';
import { CommonModule } from '../common/common.module';
import { AppConfigService } from '../common/app-config.service';
import { MessageModule } from '../messages/messages.module';
import { SERVICE_BUS_CLIENT } from './service-bus.constants';
import { ServiceBusService } from './service-bus.service';
import { ServiceBusController } from './service-bus.controller';
// import { ServiceBusWorker } from './service-bus.worker';
import { ServiceBusHealthIndicator } from './service-bus.health';

@Module({
  imports: [CommonModule, MessageModule],
  providers: [
    {
      provide: SERVICE_BUS_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new ServiceBusClient(config.serviceBusConnectionString, {
          retryOptions: {
            maxRetries: config.serviceBusMaxRetries,
            retryDelayInMs: config.serviceBusRetryDelay,
          },
        }),
    },
    ServiceBusService,
    // External applications own their subscriptions. Capture reports update tracking.
    // ServiceBusWorker,
    ServiceBusHealthIndicator,
  ],
  controllers: [ServiceBusController],
  exports: [ServiceBusService, ServiceBusHealthIndicator],
})
export class ServiceBusModule {}
