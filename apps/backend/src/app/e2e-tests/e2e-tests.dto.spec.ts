import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateScenarioDto, StartDemoRunDto } from './e2e-tests.dto';

const scenario = {
  name: 'Finance payment',
  policy: {
    publisher: 'a',
    consumer: 'b',
    messageType: 'PaymentRequested',
    provider: 'sqs',
    destination: 'payments',
    timeoutSeconds: 30,
  },
};
const options = { whitelist: true, forbidNonWhitelisted: true };
describe('E2E test request validation', () => {
  it('validates nested policy fields', async () => {
    expect(
      await validate(plainToInstance(CreateScenarioDto, scenario), options),
    ).toHaveLength(0);
    for (const policy of [
      undefined,
      [scenario.policy],
      { ...scenario.policy, timeoutSeconds: 0 },
      { ...scenario.policy, timeoutSeconds: 3601 },
      { ...scenario.policy, timeoutSeconds: 1.5 },
      { ...scenario.policy, provider: 'unknown' },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(CreateScenarioDto, { ...scenario, policy }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
    }
  });
  it('rejects injected fields and unknown demo outcomes', async () => {
    expect(
      (
        await validate(
          plainToInstance(CreateScenarioDto, {
            ...scenario,
            policy: { ...scenario.policy, url: 'http://example.com' },
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(StartDemoRunDto, { outcome: 'pretend-real-success' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
