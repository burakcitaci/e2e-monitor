import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigurationModule } from '../config/configuration.module';
import { AppConfigService } from '../config/app-config.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigurationModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.mongoUri,
        dbName: config.mongoTrackingDbName,
        authSource: config.mongoAuthSource,
      }),
      connectionName: 'MessageTrackingDb',
    }),
  ],
})
export class DatabaseModule {}
