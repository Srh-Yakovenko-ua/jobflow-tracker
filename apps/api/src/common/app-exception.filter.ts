import type { ErrorResponse } from '@jobflow/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

import { readRequestId } from './request-id.middleware.js';
import { toAppError } from './to-app-error.js';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const error = toAppError(exception);
    if (error.status >= 500) {
      this.logger.error(exception);
    }
    const body: ErrorResponse = {
      ...error.body,
      requestId: readRequestId(http.getRequest<Request>()),
    };
    this.adapterHost.httpAdapter.reply(http.getResponse(), body, error.status);
  }
}
