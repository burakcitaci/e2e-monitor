export type EvidenceKind = 'published' | 'processed' | 'failed';
export type RunStatus = 'running' | 'passed' | 'failed' | 'timed_out';

export interface ScenarioPolicy {
  publisher: string;
  consumer: string;
  messageType: string;
  provider: 'sqs' | 'azure-service-bus';
  destination: string;
  timeoutSeconds: number;
}

export interface TestScenario {
  id: string;
  name: string;
  policy: ScenarioPolicy;
  createdAt: string;
}

export interface EvidenceInput {
  eventId: string;
  correlationId: string;
  messageId: string;
  messageType: string;
  service: string;
  kind: EvidenceKind;
  provider: ScenarioPolicy['provider'];
  destination: string;
  detail?: string;
}

export interface TestEvidence extends EvidenceInput {
  receivedAt: string;
}

export interface TestRun {
  id: string;
  mode: 'demo';
  scenarioId: string;
  scenarioName: string;
  policy: ScenarioPolicy;
  correlationId: string;
  status: RunStatus;
  reason: string;
  startedAt: string;
  deadlineAt: string;
  evidence: TestEvidence[];
}

export type DemoOutcome = 'pass' | 'fail' | 'timeout';
export type TestRunSummary = Omit<TestRun, 'evidence'>;
