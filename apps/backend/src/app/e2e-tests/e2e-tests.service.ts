import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import type {
  DemoOutcome,
  EvidenceKind,
  TestEvidence,
  TestRun,
  TestRunSummary,
  TestScenario,
} from '@e2e-monitor/entities';
import { CreateScenarioDto } from './e2e-tests.dto';
import { StoredRun } from './e2e-tests.schema';
import { evaluatePolicy } from './policy-evaluator';

const waitingReason =
  'Waiting for matching publish and successful processing evidence.';

@Injectable()
export class E2eTestsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(E2eTestsService.name);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private expiryTimer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectModel('TestScenario', 'MessageTrackingDb')
    private readonly scenarios: Model<TestScenario>,
    @InjectModel('TestRun', 'MessageTrackingDb')
    private readonly runs: Model<StoredRun>,
  ) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      void this.expireRuns().catch(() =>
        this.logger.error('Could not expire overdue test runs.'),
      );
    }, 1000);
    this.expiryTimer.unref();
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  async createScenario(dto: CreateScenarioDto): Promise<TestScenario> {
    const policy = {
      ...dto.policy,
      publisher: dto.policy.publisher.trim(),
      consumer: dto.policy.consumer.trim(),
      messageType: dto.policy.messageType.trim(),
      destination: dto.policy.destination.trim(),
    };
    if (
      ![
        dto.name.trim(),
        policy.publisher,
        policy.consumer,
        policy.messageType,
        policy.destination,
      ].every(Boolean)
    ) {
      throw new BadRequestException(
        'Scenario names and policy fields must not be blank.',
      );
    }
    const scenario: TestScenario = {
      id: randomUUID(),
      name: dto.name.trim(),
      policy,
      createdAt: new Date().toISOString(),
    };
    await this.scenarios.create(scenario);
    return scenario;
  }

  async listScenarios(): Promise<TestScenario[]> {
    return this.scenarios
      .find()
      .select('-_id -__v')
      .sort({ createdAt: -1, id: -1 })
      .limit(100)
      .lean()
      .exec();
  }

  async startDemo(scenarioId: string, outcome: DemoOutcome): Promise<TestRun> {
    const scenario = await this.scenarios
      .findOne({ id: scenarioId })
      .lean()
      .exec();
    if (!scenario) throw new NotFoundException('Test scenario not found.');
    const startedAt = new Date();
    const run: TestRun = {
      id: randomUUID(),
      mode: 'demo',
      scenarioId,
      scenarioName: scenario.name,
      policy: { ...scenario.policy },
      correlationId: randomUUID(),
      status: 'running',
      reason: waitingReason,
      startedAt: startedAt.toISOString(),
      deadlineAt: new Date(
        startedAt.getTime() + scenario.policy.timeoutSeconds * 1000,
      ).toISOString(),
      evidence: [],
    };
    await this.runs.create({ ...run, revision: 0 });
    // Delays scale with the deadline, including short one-second policies.
    const duration = Math.min(1500, scenario.policy.timeoutSeconds * 400);
    this.schedule(
      () => this.appendDemoEvidence(run.id, 'published'),
      duration / 3,
    );
    if (outcome !== 'timeout') {
      this.schedule(
        () =>
          this.appendDemoEvidence(
            run.id,
            outcome === 'pass' ? 'processed' : 'failed',
          ),
        duration,
      );
    }
    return run;
  }

  async listRuns(): Promise<TestRunSummary[]> {
    await this.expireRuns();
    return this.runs
      .find()
      .select('-_id -__v -revision -evidence')
      .sort({ startedAt: -1, id: -1 })
      .limit(50)
      .lean()
      .exec();
  }

  async getRun(id: string): Promise<TestRun> {
    await this.expireRuns();
    const run = await this.runs
      .findOne({ id })
      .select('-_id -__v -revision')
      .lean()
      .exec();
    if (!run) throw new NotFoundException('Test run not found.');
    return run;
  }

  private async expireRuns() {
    const now = new Date().toISOString();
    await this.runs
      .updateMany(
        { status: 'running', deadlineAt: { $lte: now } },
        {
          $set: {
            status: 'timed_out',
            reason:
              'The deadline expired before matching publish and processing evidence arrived.',
          },
          $inc: { revision: 1 },
        },
      )
      .exec();
  }

  private schedule(action: () => Promise<void>, delay: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void action().catch(() =>
        this.logger.error('Could not record simulated test evidence.'),
      );
    }, delay);
    timer.unref();
    this.timers.add(timer);
  }

  private async appendDemoEvidence(
    id: string,
    kind: EvidenceKind,
  ): Promise<void> {
    // A revision check keeps concurrent callbacks and deadline expiry atomic,
    // without requiring MongoDB replica-set transactions.
    for (let attempt = 0; attempt < 5; attempt++) {
      const run = await this.runs.findOne({ id }).lean().exec();
      if (!run || run.status !== 'running' || run.mode !== 'demo') return;
      if (run.evidence.some((event) => event.eventId === `demo-${kind}`))
        return;
      const receivedAt = new Date().toISOString();
      const event: TestEvidence = {
        eventId: `demo-${kind}`,
        kind,
        correlationId: run.correlationId,
        messageId: `demo-${id}`,
        messageType: run.policy.messageType,
        provider: run.policy.provider,
        destination: run.policy.destination,
        service:
          kind === 'published' ? run.policy.publisher : run.policy.consumer,
        detail:
          kind === 'failed'
            ? 'Simulated processing failure.'
            : 'Simulated application evidence; no broker operation was performed.',
        receivedAt,
      };
      const evidence = [...run.evidence, event];
      const verdict = evaluatePolicy(
        run.policy,
        evidence,
        run.correlationId,
        receivedAt,
        run.deadlineAt,
      );
      const result = await this.runs
        .updateOne(
          { id, revision: run.revision, status: 'running' },
          {
            $set: {
              evidence: receivedAt < run.deadlineAt ? evidence : run.evidence,
              ...verdict,
            },
            $inc: { revision: 1 },
          },
        )
        .exec();
      if (result.modifiedCount === 1) return;
    }
    throw new Error('Concurrent test-run update could not be resolved.');
  }
}
