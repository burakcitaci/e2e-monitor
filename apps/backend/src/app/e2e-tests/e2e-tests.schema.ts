import { Schema } from 'mongoose';
import type { TestRun, TestScenario } from '@e2e-monitor/entities';

export interface StoredRun extends TestRun {
  revision: number;
}

const policy = new Schema(
  {
    publisher: { type: String, required: true },
    consumer: { type: String, required: true },
    messageType: { type: String, required: true },
    provider: {
      type: String,
      enum: ['sqs', 'azure-service-bus'],
      required: true,
    },
    destination: { type: String, required: true },
    timeoutSeconds: { type: Number, min: 1, max: 3600, required: true },
  },
  { _id: false },
);

const evidence = new Schema(
  {
    eventId: { type: String, required: true },
    correlationId: { type: String, required: true },
    messageId: { type: String, required: true },
    messageType: { type: String, required: true },
    service: { type: String, required: true },
    kind: {
      type: String,
      enum: ['published', 'processed', 'failed'],
      required: true,
    },
    provider: {
      type: String,
      enum: ['sqs', 'azure-service-bus'],
      required: true,
    },
    destination: { type: String, required: true },
    detail: String,
    receivedAt: { type: String, required: true },
  },
  { _id: false },
);

export const TestScenarioSchema = new Schema<TestScenario>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    policy: { type: policy, required: true },
    createdAt: { type: String, required: true },
  },
  { collection: 'TestScenarios' },
);
TestScenarioSchema.index({ createdAt: -1, id: -1 });

export const TestRunSchema = new Schema<StoredRun>(
  {
    id: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['demo'], required: true },
    scenarioId: { type: String, required: true },
    scenarioName: { type: String, required: true },
    policy: { type: policy, required: true },
    correlationId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['running', 'passed', 'failed', 'timed_out'],
      required: true,
    },
    reason: { type: String, required: true },
    startedAt: { type: String, required: true },
    deadlineAt: { type: String, required: true },
    evidence: { type: [evidence], default: [] },
    revision: { type: Number, required: true, default: 0 },
  },
  { collection: 'TestRuns' },
);
TestRunSchema.index({ startedAt: -1, id: -1 });
TestRunSchema.index({ status: 1, deadlineAt: 1 });
