import { HttpException, HttpStatus } from '@nestjs/common';

export class DockerConnectionException extends HttpException {
  constructor(message = 'Failed to connect to Docker daemon') {
    super(
      {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Docker Connection Error',
        message,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ContainerNotFoundException extends HttpException {
  constructor(containerId: string) {
    super(
      {
        status: HttpStatus.NOT_FOUND,
        error: 'Container Not Found',
        message: `Container '${containerId}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ContainerOperationException extends HttpException {
  constructor(operation: string, containerId: string, originalError?: Error) {
    super(
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Container Operation Failed',
        message: `Failed to ${operation} container '${containerId}'`,
        details: originalError?.message,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class FileNotFoundException extends HttpException {
  constructor(fileName: string) {
    super(
      {
        status: HttpStatus.NOT_FOUND,
        error: 'File Not Found',
        message: `File '${fileName}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(message: string, errors?: unknown[]) {
    super(
      {
        status: HttpStatus.BAD_REQUEST,
        error: 'Validation Error',
        message,
        validationErrors: errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
