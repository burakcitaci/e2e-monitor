import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'PolicyEvaluations', timestamps: true })
export class PolicyEvaluation {
  @Prop({ required: true, index: true }) policyId!: string;
  @Prop({ required: true, index: true }) evaluatedAt!: Date;
  @Prop({ required: true, type: Object }) result!: Record<string, unknown>;
}

export const PolicyEvaluationSchema =
  SchemaFactory.createForClass(PolicyEvaluation);
PolicyEvaluationSchema.index({ policyId: 1, evaluatedAt: -1 });
