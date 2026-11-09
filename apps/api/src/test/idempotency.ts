import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { expect } from 'vitest';

import { IDEMPOTENCY_HEADER } from '../common/idempotency/idempotency-request.js';
import { callRoute, type RouteCall } from './http.js';

export type ReplayedCreate = {
  app: NestExpressApplication;
  call: RouteCall;
  countRows: () => Promise<number[]>;
  status?: number;
};

export const keyHeaders = (key: string = randomUUID()) => ({ [IDEMPOTENCY_HEADER]: key });

export async function expectReplayedCreate({
  app,
  call,
  countRows,
  status = 201,
}: ReplayedCreate): Promise<void> {
  const before = await countRows();
  const keyed = { ...call, headers: { ...call.headers, ...keyHeaders() } };

  const first = await callRoute(app, keyed);
  const second = await callRoute(app, keyed);

  expect(first.status).toBe(status);
  expect([second.status, second.body]).toEqual([first.status, first.body]);
  expect(await countRows()).toEqual(before.map((count) => count + 1));
}
