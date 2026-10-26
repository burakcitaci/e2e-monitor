import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePolicyDto, UpdatePolicyDto } from './policy.dto';
import { Policy } from './policy.schema';
import { EvaluatorService } from './evaluator.service';

const policyIdentity = (policy: CreatePolicyDto) =>
  [
    policy.namespace,
    policy.sourceService,
    policy.destinationService,
    policy.destination,
    policy.subscription,
    policy.thresholdSeconds,
    policy.requiredSuccessPercentage ?? 95,
    policy.evaluationWindowMinutes ?? 30,
    policy.minimumSampleCount ?? 1,
  ]
    .map((value) => String(value).trim().toLowerCase())
    .join('|');

const policyContract = (policy: CreatePolicyDto) => ({
  namespace: policy.namespace.trim(),
  sourceService: policy.sourceService.trim(),
  destinationService: policy.destinationService.trim(),
  destination: policy.destination.trim(),
  subscription: policy.subscription.trim(),
  thresholdSeconds: policy.thresholdSeconds,
  requiredSuccessPercentage: policy.requiredSuccessPercentage ?? 95,
  evaluationWindowMinutes: policy.evaluationWindowMinutes ?? 30,
  minimumSampleCount: policy.minimumSampleCount ?? 1,
});

@Injectable()
export class PoliciesService {
  constructor(
    @InjectModel(Policy.name, 'MessageTrackingDb')
    private readonly model: Model<Policy>,
    private readonly evaluator: EvaluatorService,
  ) {}

  async list() {
    const policies = await this.model
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const latest = await this.evaluator.latest(
      policies.map((policy) => String(policy._id)),
    );
    return policies.map((policy) => ({
      ...this.serialize(policy),
      latestEvaluation: latest.get(String(policy._id)),
    }));
  }
  async create(dto: CreatePolicyDto) {
    const identity = policyIdentity(dto);
    const duplicate = await this.model
      .findOne({ $or: [{ identity }, policyContract(dto)] })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (duplicate) {
      throw new ConflictException('An identical policy already exists');
    }
    try {
      const created = await this.model.create({ ...dto, identity });
      const serialized = this.serialize(created.toObject());
      await this.evaluator.evaluateOne(created.toObject());
      return serialized;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('An identical policy already exists');
      }
      throw error;
    }
  }
  async update(id: string, dto: UpdatePolicyDto) {
    const existing = await this.model.findById(id).lean().exec();
    if (!existing) throw new NotFoundException('Policy not found');
    const merged = { ...existing, ...dto } as unknown as CreatePolicyDto;
    try {
      const result = await this.model
        .findByIdAndUpdate(
          id,
          { ...dto, identity: policyIdentity(merged) },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();
      if (!result) throw new NotFoundException('Policy not found');
      const serialized = this.serialize(result);
      await this.evaluator.evaluateOne(result);
      return serialized;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('An identical policy already exists');
      }
      throw error;
    }
  }
  async remove(id: string) {
    const result = await this.model.findByIdAndDelete(id).lean().exec();
    if (!result) throw new NotFoundException('Policy not found');
    await this.evaluator.removeHistory(id);
    return { id };
  }

  async detail(id: string, minutes?: number) {
    const policy = await this.model.findById(id).lean().exec();
    if (!policy) throw new NotFoundException('Policy not found');
    const evaluations = await this.evaluator.history(id);
    return {
      policy: this.serialize(policy),
      latestEvaluation: evaluations.at(-1),
      evaluations,
      analysis: minutes
        ? await this.evaluator.analyzeRange(policy, minutes)
        : undefined,
    };
  }

  async evaluate(id: string) {
    const policy = await this.model.findById(id).lean().exec();
    if (!policy) throw new NotFoundException('Policy not found');
    return this.evaluator.evaluateOne(policy);
  }

  private serialize<T extends { _id: unknown }>(policy: T) {
    const serializable = { ...policy } as T & { identity?: string };
    delete serializable.identity;
    return { ...serializable, _id: String(policy._id) };
  }
}
