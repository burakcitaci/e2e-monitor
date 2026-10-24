import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { environmentSchema } from './environment';

describe('application environment', () => {
  it('preserves collector defaults with optional AI configuration', () => {
    const { error, value } = environmentSchema.validate({});
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: 'http://localhost:4200',
      MONGO_MESSAGE_DB: 'MessageTrackingDb',
      MONGO_AUTH_SOURCE: 'admin',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
      THROTTLE_TTL: 60,
      THROTTLE_LIMIT: 60,
    });
  });

  it('normalizes numeric environment values and rejects invalid startup configuration', () => {
    expect(environmentSchema.validate({ PORT: '4100' }).value.PORT).toBe(4100);
    expect(
      environmentSchema.validate({ PORT: 'not-a-port' }).error,
    ).toBeDefined();
    expect(
      environmentSchema.validate({ NODE_ENV: 'unknown' }).error,
    ).toBeDefined();
  });

  it('supports multiple CORS origins without changing their configured order', () => {
    const config = new AppConfigService(
      new ConfigService({
        CORS_ORIGIN: 'http://first.test, http://second.test',
      }),
    );
    expect(config.corsOrigin).toEqual([
      'http://first.test',
      'http://second.test',
    ]);
  });
});
