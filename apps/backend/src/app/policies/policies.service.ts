import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CaptureService } from '../capture/capture.service';
import { CreatePolicyDto, UpdatePolicyDto } from './policy.dto';
import { Policy } from './policy.schema';
import { evaluatePolicy } from './policy-evaluator';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectModel(Policy.name, 'MessageTrackingDb')
    private readonly model: Model<Policy>,
    private readonly capture: CaptureService,
  ) {}

  async list() {
    const policies = await this.model
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return policies.map((policy) => this.serialize(policy));
  }
  async create(dto: CreatePolicyDto) {
    const created = await this.model.create(dto);
    return this.serialize(created.toObject());
  }
  async update(id: string, dto: UpdatePolicyDto) {
    const result = await this.model
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!result) throw new NotFoundException('Policy not found');
    return this.serialize(result);
  }
  async remove(id: string) {
    const result = await this.model.findByIdAndDelete(id).lean().exec();
    if (!result) throw new NotFoundException('Policy not found');
    return { id };
  }

  async evaluate(id: string) {
    const policy = await this.model.findById(id).lean().exec();
    if (!policy) throw new NotFoundException('Policy not found');
    const captures = await this.capture.allStates();
    const evaluatedAt = new Date();
    return {
      policyId: String(policy._id),
      thresholdSeconds: policy.thresholdSeconds,
      requiredSuccessPercentage: policy.requiredSuccessPercentage,
      evaluatedAt: evaluatedAt.toISOString(),
      ...evaluatePolicy(policy, captures, evaluatedAt),
    };
  }

  private serialize<T extends { _id: unknown }>(policy: T) {
    return { ...policy, _id: String(policy._id) };
  }
}
