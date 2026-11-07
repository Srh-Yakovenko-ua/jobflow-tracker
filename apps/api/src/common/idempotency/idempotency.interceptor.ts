import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { catchError, mergeMap, type Observable, of } from 'rxjs';

import { IdempotencyService } from './idempotency.service.js';
import { keyOf, requestHashOf } from './idempotency-request.js';
import { IDEMPOTENT } from './idempotent.decorator.js';

type FirstRun = { userId: string; key: string };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = this.isIdempotent(context) ? keyOf(req) : undefined;
    const userId = req.user?.id;
    if (key === undefined || userId === undefined) return next.handle();
    const claim = await this.idempotency.claim(userId, { key, requestHash: requestHashOf(req) });
    if (claim.claimed) return this.runFirst(next, { userId, key });
    return of(claim.reply.body);
  }

  private isIdempotent(context: ExecutionContext): boolean {
    return this.reflector.get<boolean | undefined>(IDEMPOTENT, context.getHandler()) === true;
  }

  private runFirst(next: CallHandler, { userId, key }: FirstRun): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        await this.idempotency.complete(userId, { key, reply: { body } });
        return body;
      }),
      catchError(async (error: unknown) => {
        await this.idempotency.release(userId, key);
        throw error;
      }),
    );
  }
}
