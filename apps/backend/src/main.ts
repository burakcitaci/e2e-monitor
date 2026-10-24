import { Logger } from '@nestjs/common';
import { bootstrap } from './bootstrap/bootstrap.js';

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  if (error instanceof Error) {
    logger.error(
      `❌ Failed to start application: ${error.message}`,
      error.stack,
    );
  } else {
    logger.error('❌ Failed to start application due to an unknown error');
  }
  process.exit(1);
});
