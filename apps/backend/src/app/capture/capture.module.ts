import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CaptureController } from './capture.controller';
import { CaptureService, CapturedMessageSchema } from './capture.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature(
      [{ name: 'CapturedMessage', schema: CapturedMessageSchema }],
      'MessageTrackingDb',
    ),
  ],
  controllers: [CaptureController],
  providers: [CaptureService],
  exports: [CaptureService],
})
export class CaptureModule {}
