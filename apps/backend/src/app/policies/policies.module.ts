import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaptureModule } from '../capture/capture.module';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { Policy, PolicySchema } from './policy.schema';

@Module({
  imports: [
    CaptureModule,
    MongooseModule.forFeature(
      [{ name: Policy.name, schema: PolicySchema }],
      'MessageTrackingDb',
    ),
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService],
})
export class PoliciesModule {}
