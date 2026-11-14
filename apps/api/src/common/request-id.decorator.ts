import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { readRequestId } from './request-id.middleware.js';

export const RequestId = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  readRequestId(context.switchToHttp().getRequest<Request>()),
);
