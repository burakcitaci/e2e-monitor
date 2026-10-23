import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'Policies', timestamps: true })
export class Policy {
  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ required: true, trim: true }) namespace!: string;
  @Prop({ required: true, trim: true }) sourceService!: string;
  @Prop({ required: true, trim: true }) destinationService!: string;
  @Prop({ required: true, trim: true }) destination!: string;
  @Prop({ required: true, trim: true }) subscription!: string;
  @Prop({ required: true, min: 0.001 }) thresholdSeconds!: number;
  @Prop({ default: 95, min: 0, max: 100 })
  requiredSuccessPercentage!: number;
  @Prop({ default: 30, min: 1 }) evaluationWindowMinutes!: number;
  @Prop({ default: 1, min: 1 }) minimumSampleCount!: number;
  @Prop({ default: true }) enabled!: boolean;
  @Prop({ default: Date.now }) effectiveFrom!: Date;
}

export const PolicySchema = SchemaFactory.createForClass(Policy);
