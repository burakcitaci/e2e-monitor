import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app/app.module';
import { AppConfigService } from '../app/config/app-config.service';
import { configureApplication } from './configure-application';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(AppConfigService);
  configureApplication(app, config);
  await app.listen(config.port);

  const logger = new Logger('Bootstrap');
  logger.log(
    `🚀 Application started on http://localhost:${config.port}/api/v1`,
  );
  logger.log(`📊 Environment: ${config.nodeEnv}`);
  return app;
}
