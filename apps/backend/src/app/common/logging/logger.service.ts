import { Injectable, Logger, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends Logger {
  protected override context: string | undefined;

  setContext(context: string) {
    this.context = context;
  }

  override log(message: string, data?: unknown) {
    const msg = data ? `${message} | ${JSON.stringify(data)}` : message;
    super.log(msg, this.context);
  }

  override error(message: unknown, ...optionalParams: unknown[]) {
    // Handle custom error logging with Error object and data
    if (optionalParams.length >= 1 && optionalParams[0] instanceof Error) {
      const error = optionalParams[0];
      const data = optionalParams[1];
      const msg = data
        ? `${message} | ${error.message} | ${JSON.stringify(data)}`
        : `${message} | ${error.message}`;
      super.error(msg, error.stack, this.context);
    } else {
      // Fallback to standard Logger behavior
      super.error(message, ...optionalParams);
    }
  }

  override warn(message: string, data?: unknown) {
    const msg = data ? `${message} | ${JSON.stringify(data)}` : message;
    super.warn(msg, this.context);
  }

  override debug(message: string, data?: unknown) {
    const msg = data ? `${message} | ${JSON.stringify(data)}` : message;
    super.debug(msg, this.context);
  }
}
