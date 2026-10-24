import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaptureModule } from '../capture/capture.module';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { Policy, PolicySchema } from './policy.schema';
import {
  PolicyEvaluation,
  PolicyEvaluationSchema,
} from './policy-evaluation.schema';
import { EvaluatorService } from './evaluator.service';

@Module({
  imports: [
    CaptureModule,
    MongooseModule.forFeature(
      [
        { name: Policy.name, schema: PolicySchema },
        { name: PolicyEvaluation.name, schema: PolicyEvaluationSchema },
      ],
      'MessageTrackingDb',
    ),
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService, EvaluatorService],
})
export class PoliciesModule {}
