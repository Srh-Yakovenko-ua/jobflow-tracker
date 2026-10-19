import type { ErrorResponse } from '@jobflow/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

import { readRequestId } from './request-id.middleware.js';
import { toAppError } from './to-app-error.js';

type Failure = { exception: unknown; req: Request; body: ErrorResponse };

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const error = toAppError(exception);
    const body: ErrorResponse = { ...error.body, requestId: readRequestId(req) };
    this.report({ exception, req, body });
    this.adapterHost.httpAdapter.reply(http.getResponse(), body, error.status);
  }

  private report({ exception, req, body }: Failure): void {
    const inRequestLog = Object.hasOwn(req, 'log');
    const failed = body.status >= 500;
    if (inRequestLog && !failed) {
      return;
    }
    const fields = inRequestLog
      ? {}
      : {
          requestId: body.requestId,
          method: req.method,
          url: req.originalUrl,
          status: body.status,
        };
    if (failed) {
      this.logger.error({ ...fields, err: exception }, 'request failed');
    } else {
      this.logger.warn(fields, 'request rejected');
    }
  }
}
