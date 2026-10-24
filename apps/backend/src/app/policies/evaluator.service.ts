import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CaptureService } from '../capture/capture.service';
import { PolicyEvaluation } from './policy-evaluation.schema';
import { evaluatePolicy, EvaluationPolicy } from './policy-evaluator';
import { Policy } from './policy.schema';

const EVALUATION_INTERVAL_MS = 30_000;
const MAX_HISTORY = 240;

@Injectable()
export class EvaluatorService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(EvaluatorService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @InjectModel(Policy.name, 'MessageTrackingDb')
    private readonly policies: Model<Policy>,
    @InjectModel(PolicyEvaluation.name, 'MessageTrackingDb')
    private readonly evaluations: Model<PolicyEvaluation>,
    private readonly capture: CaptureService,
  ) {}

  onApplicationBootstrap() {
    void this.evaluateAll();
    this.timer = setInterval(
      () => void this.evaluateAll(),
      EVALUATION_INTERVAL_MS,
    );
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async evaluateAll() {
    if (this.running) return;
    this.running = true;
    try {
      const [policies, captures] = await Promise.all([
        this.policies.find().lean().exec(),
        this.capture.allStates(),
      ]);
      const evaluatedAt = new Date();
      if (policies.length) {
        await this.evaluations.insertMany(
          policies.map((policy) => ({
            policyId: String(policy._id),
            evaluatedAt,
            result: this.result(policy, captures, evaluatedAt),
          })),
        );
      }
    } catch (error) {
      this.logger.error('Scheduled policy evaluation failed', error);
    } finally {
      this.running = false;
    }
  }

  async evaluateOne(policy: Policy & { _id: unknown }) {
    const evaluatedAt = new Date();
    const result = this.result(
      policy,
      await this.capture.allStates(),
      evaluatedAt,
    );
    await this.evaluations.create({
      policyId: String(policy._id),
      evaluatedAt,
      result,
    });
    return result;
  }

  async latest(policyIds: string[]) {
    if (!policyIds.length) return new Map<string, Record<string, unknown>>();
    const rows = await this.evaluations
      .aggregate<{ _id: string; result: Record<string, unknown> }>([
        { $match: { policyId: { $in: policyIds } } },
        { $sort: { evaluatedAt: -1 } },
        { $group: { _id: '$policyId', result: { $first: '$result' } } },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id, row.result]));
  }

  async analyzeRange(policy: Policy & { _id: unknown }, minutes: number) {
    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60_000);
    const captures = await this.capture.statesInRange(
      policy.namespace,
      policy.destination,
      from,
      now,
    );
    return {
      ...this.result(
        { ...policy, effectiveFrom: from, evaluationWindowMinutes: minutes },
        captures,
        now,
      ),
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }

  async history(policyId: string) {
    const rows = await this.evaluations
      .find({ policyId })
      .sort({ evaluatedAt: -1 })
      .limit(MAX_HISTORY)
      .lean()
      .exec();
    return rows.map((row) => row.result).reverse();
  }

  async removeHistory(policyId: string) {
    await this.evaluations.deleteMany({ policyId }).exec();
  }

  private result(
    policy: EvaluationPolicy & { _id: unknown },
    captures: Awaited<ReturnType<CaptureService['allStates']>>,
    evaluatedAt: Date,
  ) {
    return {
      policyId: String(policy._id),
      thresholdSeconds: policy.thresholdSeconds,
      requiredSuccessPercentage: policy.requiredSuccessPercentage,
      evaluatedAt: evaluatedAt.toISOString(),
      ...evaluatePolicy(policy, captures, evaluatedAt),
    };
  }
}
