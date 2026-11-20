import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { type RefreshClient, sessionClientOf } from './refresh-cookie.js';

export const SessionClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RefreshClient =>
    sessionClientOf(context.switchToHttp().getRequest<Request>()),
);
