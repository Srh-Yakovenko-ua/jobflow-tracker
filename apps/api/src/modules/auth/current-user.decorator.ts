import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { unauthorized } from '../../common/app-error.js';
import type { AccessUser } from './access-tokens.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessUser => {
    const { user } = context.switchToHttp().getRequest<Request>();
    if (user === undefined) {
      throw unauthorized();
    }
    return user;
  },
);
