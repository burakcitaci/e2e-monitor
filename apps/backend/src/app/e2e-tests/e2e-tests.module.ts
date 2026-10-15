import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { E2eTestsController } from './e2e-tests.controller';
import { E2eTestsService } from './e2e-tests.service';
import { TestRunSchema, TestScenarioSchema } from './e2e-tests.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: 'TestScenario', schema: TestScenarioSchema },
        { name: 'TestRun', schema: TestRunSchema },
      ],
      'MessageTrackingDb',
    ),
  ],
  controllers: [E2eTestsController],
  providers: [E2eTestsService],
})
export class E2eTestsModule {}
