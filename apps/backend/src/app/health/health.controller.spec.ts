import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import type { Connection } from 'mongoose';
import { HealthController } from './health.controller';
import { AppModule } from '../app.module';

describe('Collector health and module boundary', () => {
  it('checks MongoDB readiness without a broker dependency', async () => {
    const pingCheck = jest
      .fn<() => Promise<{ messageTrackingDb: { status: string } }>>()
      .mockResolvedValue({ messageTrackingDb: { status: 'up' } });
    const check = jest.fn(async (checks: (() => Promise<unknown>)[]) =>
      Promise.all(checks.map((run) => run())),
    );
    const connection = {} as Connection;
    const controller = new HealthController(
      { check } as unknown as HealthCheckService,
      { pingCheck } as unknown as MongooseHealthIndicator,
      connection,
    );
    await controller.ready();
    expect(check.mock.calls[0][0]).toHaveLength(1);
    expect(pingCheck).toHaveBeenCalledWith('messageTrackingDb', { connection });
  });
  it('loads AI chat and capture storage without broker modules', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as {
      name?: string;
    }[];
    const names = imports.map((module) => module.name).filter(Boolean);
    expect(names).toContain('MessagingChatModule');
    expect(names).toContain('MessageModule');
    expect(names).not.toContain('ServiceBusModule');
    expect(names).not.toContain('AwsSqsModule');
  });
});
