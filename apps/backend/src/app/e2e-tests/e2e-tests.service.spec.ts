import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { Model } from 'mongoose';
import type { TestScenario } from '@e2e-monitor/entities';
import { E2eTestsService } from './e2e-tests.service';
import type { StoredRun } from './e2e-tests.schema';

function query<T>(read: () => T) {
  const chain = {
    select: () => chain,
    sort: () => chain,
    limit: () => chain,
    lean: () => chain,
    exec: async () => structuredClone(read()),
  };
  return chain;
}

describe('Persistent demo test runs', () => {
  let service: E2eTestsService;
  let scenarios: TestScenario[];
  let runs: StoredRun[];
  const input = {
    name: 'Finance payment',
    policy: {
      publisher: 'a',
      consumer: 'b',
      messageType: 'PaymentRequested',
      provider: 'sqs' as const,
      destination: 'payments',
      timeoutSeconds: 3,
    },
  };
  let scenarioModel: {
    create: ReturnType<typeof jest.fn>;
    find: ReturnType<typeof jest.fn>;
    findOne: ReturnType<typeof jest.fn>;
  };
  let runModel: {
    create: ReturnType<typeof jest.fn>;
    find: ReturnType<typeof jest.fn>;
    findOne: ReturnType<typeof jest.fn>;
    updateMany: ReturnType<typeof jest.fn>;
    updateOne: ReturnType<typeof jest.fn>;
  };
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-15T10:00:00.000Z'));
    scenarios = [];
    runs = [];
    scenarioModel = {
      create: jest.fn(async (value: TestScenario) => {
        scenarios.push(structuredClone(value));
      }),
      find: jest.fn(() => query(() => scenarios)),
      findOne: jest.fn((filter: { id: string }) =>
        query(() => scenarios.find((item) => item.id === filter.id) ?? null),
      ),
    };
    runModel = {
      create: jest.fn(async (value: StoredRun) => {
        runs.push(structuredClone(value));
      }),
      find: jest.fn(() => query(() => runs)),
      findOne: jest.fn((filter: { id: string }) =>
        query(() => runs.find((item) => item.id === filter.id) ?? null),
      ),
      updateMany: jest.fn(
        (
          filter: { deadlineAt: { $lte: string } },
          update: { $set: Partial<StoredRun> },
        ) =>
          query(() => {
            for (const run of runs)
              if (
                run.status === 'running' &&
                run.deadlineAt <= filter.deadlineAt.$lte
              ) {
                Object.assign(run, update.$set);
                run.revision++;
              }
            return {};
          }),
      ),
      updateOne: jest.fn(
        (
          filter: { id: string; revision: number },
          update: { $set: Partial<StoredRun> },
        ) =>
          query(() => {
            const run = runs.find(
              (item) =>
                item.id === filter.id &&
                item.revision === filter.revision &&
                item.status === 'running',
            );
            if (!run) return { modifiedCount: 0 };
            Object.assign(run, structuredClone(update.$set));
            run.revision++;
            return { modifiedCount: 1 };
          }),
      ),
    };
    service = new E2eTestsService(
      scenarioModel as unknown as Model<TestScenario>,
      runModel as unknown as Model<StoredRun>,
    );
  });
  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('saves a policy snapshot and passes only after both demo events arrive', async () => {
    const scenario = await service.createScenario(input);
    const run = await service.startDemo(scenario.id, 'pass');
    scenarios[0].policy.consumer = 'changed-after-start';
    expect(run.status).toBe('running');
    expect(run.mode).toBe('demo');
    await jest.advanceTimersByTimeAsync(500);
    expect(runs[0].evidence.map((event) => event.kind)).toEqual(['published']);
    expect(runs[0].status).toBe('running');
    await jest.advanceTimersByTimeAsync(800);
    expect(runs[0].status).toBe('passed');
    expect(runs[0].policy.consumer).toBe('b');
    expect(runs[0].evidence[0].messageId).toBe(runs[0].evidence[1].messageId);
    expect(
      runs[0].evidence.every(
        (event) => event.correlationId === run.correlationId,
      ),
    ).toBe(true);
  });
  it('records explicit consumer failure', async () => {
    const scenario = await service.createScenario(input);
    await service.startDemo(scenario.id, 'fail');
    await jest.advanceTimersByTimeAsync(1500);
    expect(runs[0].status).toBe('failed');
    expect(runs[0].evidence[1].kind).toBe('failed');
  });
  it('expires overdue runs in the background without requiring a browser', async () => {
    service.onModuleInit();
    const scenario = await service.createScenario(input);
    await service.startDemo(scenario.id, 'timeout');
    await jest.advanceTimersByTimeAsync(3000);
    expect(runs[0].status).toBe('timed_out');
  });
  it('times out missing consumers, including after process restart', async () => {
    const scenario = await service.createScenario(input);
    const run = await service.startDemo(scenario.id, 'timeout');
    await jest.advanceTimersByTimeAsync(500);
    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2500);
    service = new E2eTestsService(
      scenarioModel as unknown as Model<TestScenario>,
      runModel as unknown as Model<StoredRun>,
    );
    expect((await service.getRun(run.id)).status).toBe('timed_out');
    expect(runs[0].evidence).toHaveLength(1);
  });
  it('does not append late processing evidence or turn a timeout into a pass', async () => {
    const scenario = await service.createScenario(input);
    await service.startDemo(scenario.id, 'pass');
    await jest.advanceTimersByTimeAsync(500);
    runs[0].deadlineAt = new Date().toISOString();
    await jest.advanceTimersByTimeAsync(1000);
    expect(runs[0].status).toBe('timed_out');
    expect(runs[0].evidence).toHaveLength(1);
  });
  it('retries a competing revision update without duplicating evidence', async () => {
    const scenario = await service.createScenario(input);
    await service.startDemo(scenario.id, 'pass');
    runModel.updateOne.mockImplementationOnce(() =>
      query(() => {
        runs[0].revision++;
        return { modifiedCount: 0 };
      }),
    );
    await jest.advanceTimersByTimeAsync(1500);
    expect(runs[0].status).toBe('passed');
    expect(runs[0].evidence).toHaveLength(2);
  });
  it('isolates simultaneous runs by correlation and message identity', async () => {
    const scenario = await service.createScenario(input);
    await service.startDemo(scenario.id, 'pass');
    await service.startDemo(scenario.id, 'timeout');
    await jest.advanceTimersByTimeAsync(1500);
    expect(runs.map((run) => run.status)).toEqual(['passed', 'running']);
    expect(runs[0].correlationId).not.toBe(runs[1].correlationId);
  });
  it('returns not found for missing scenarios and runs', async () => {
    await expect(service.startDemo('missing', 'pass')).rejects.toThrow(
      'Test scenario not found',
    );
    await expect(service.getRun('missing')).rejects.toThrow(
      'Test run not found',
    );
  });
  it('rejects whitespace-only policy inputs', async () => {
    await expect(
      service.createScenario({ ...input, name: ' ' }),
    ).rejects.toThrow('must not be blank');
    expect(scenarioModel.create).not.toHaveBeenCalled();
  });
});
