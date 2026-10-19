import { HttpException } from '@nestjs/common';

import { AppError, errorFor, isErrorStatus } from './app-error.js';

type ClientError = { status: number; message: string };

function isExposedClientError(exception: unknown): exception is ClientError {
  return (
    exception instanceof Error &&
    'status' in exception &&
    typeof exception.status === 'number' &&
    'expose' in exception &&
    exception.expose === true
  );
}

function clientErrorOf(exception: unknown): ClientError | undefined {
  if (exception instanceof HttpException) {
    return { status: exception.getStatus(), message: exception.message };
  }
  return isExposedClientError(exception) ? exception : undefined;
}

export function toAppError(exception: unknown): AppError {
  if (exception instanceof AppError) {
    return exception;
  }
  const clientError = clientErrorOf(exception);
  if (clientError === undefined || clientError.status < 400 || clientError.status >= 500) {
    return errorFor(500);
  }
  const status = isErrorStatus(clientError.status) ? clientError.status : 400;
  return errorFor(status, clientError.message);
}
