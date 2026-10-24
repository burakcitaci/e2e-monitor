import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../logging/logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status = this.getStatus(exception);
    const message = this.getMessage(exception);

    if (exception instanceof Error) {
      this.logger.error(message, exception);
    } else {
      this.logger.error(message);
    }

    response.status(status).json({
      statusCode: status,
      path: request?.url ?? 'unknown',
      timestamp: new Date().toISOString(),
      message,
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null) {
        const payload = response as Record<string, unknown>;
        return (payload.message as string) ?? JSON.stringify(payload);
      }
    }

    return 'Internal server error';
  }
}
