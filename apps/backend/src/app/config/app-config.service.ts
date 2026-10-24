import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { loadServiceBusConfig } from './service-bus-config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get port(): number {
    return this.config.get<number>('PORT', 3000);
  }
  get nodeEnv(): string {
    return this.config.get<string>('NODE_ENV', 'development');
  }
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }
  get corsOrigin(): string | string[] {
    const origin = this.config.get<string>(
      'CORS_ORIGIN',
      'http://localhost:4200',
    );
    return origin.includes(',')
      ? origin.split(',').map((value) => value.trim())
      : origin;
  }
  get logLevel(): string {
    return this.config.get<string>('LOG_LEVEL', 'info');
  }
  get serviceBusNamespace(): string {
    return this.config.get<string>('SERVICE_BUS_NAMESPACE', 'sbemulatorns');
  }
  get mongoUri(): string {
    return this.config.get<string>(
      'MONGO_URI',
      'mongodb://testuser:testpass@localhost:27017/',
    );
  }
  get mongoTrackingDbName(): string {
    return this.config.get<string>('MONGO_MESSAGE_DB', 'MessageTrackingDb');
  }
  get mongoAuthSource(): string {
    return this.config.get<string>('MONGO_AUTH_SOURCE', 'admin');
  }
  get throttleTtl(): number {
    return this.config.get<number>('THROTTLE_TTL', 60);
  }
  get throttleLimit(): number {
    return this.config.get<number>('THROTTLE_LIMIT', 60);
  }
  getServiceBusConfiguration() {
    return loadServiceBusConfig(this.serviceBusNamespace);
  }
}
