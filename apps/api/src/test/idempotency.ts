import { randomUUID } from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { expect } from 'vitest';

import { callRoute, type RouteCall } from './http.js';

export type ReplayedCreate = {
  app: NestExpressApplication;
  call: RouteCall;
  countRows: () => Promise<number[]>;
};

export const keyHeaders = (key: string = randomUUID()) => ({ 'Idempotency-Key': key });

export async function expectReplayedCreate({
  app,
  call,
  countRows,
}: ReplayedCreate): Promise<void> {
  const before = await countRows();
  const keyed = { ...call, headers: keyHeaders() };

  const first = await callRoute(app, keyed);
  const second = await callRoute(app, keyed);

  expect(first.status).toBe(201);
  expect([second.status, second.body]).toEqual([first.status, first.body]);
  expect(await countRows()).toEqual(before.map((count) => count + 1));
}
