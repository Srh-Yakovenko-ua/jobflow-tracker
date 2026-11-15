import { captureRetryResponseSchema } from '@jobflow/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { expect } from 'vitest';
import type { z } from 'zod';

import { OutboxRelayService } from '../outbox/outbox-relay.service.js';
import { storedAiJob } from './ai.js';
import type { TestApp } from './app.js';
import { callRoute } from './http.js';

export const AI_WORKER_TEST = { timeout: 45_000 };

const SETTLED = { timeout: 30_000 };

export type AiRouteCaller = { applicationId: string; accessToken?: string | undefined };

export type ApplicationAiRoute<R> = { path: (id: string) => string; response: z.ZodType<R> };

export function applicationAiRoute<R>(testApp: TestApp, route: ApplicationAiRoute<R>) {
  const call = (method: 'get' | 'post', { accessToken, applicationId }: AiRouteCaller) =>
    callRoute(testApp.app, { method, path: route.path(applicationId), accessToken });

  async function requested(caller: AiRouteCaller): Promise<string> {
    const response = await call('post', caller);
    expect(response.status).toBe(202);
    return captureRetryResponseSchema.parse(response.body).jobId;
  }

  async function read(caller: AiRouteCaller): Promise<R> {
    const response = await call('get', caller);
    expect(response.status).toBe(200);
    return route.response.parse(response.body);
  }

  async function settled(worker: INestApplicationContext, jobId: string) {
    await worker.get(OutboxRelayService, { strict: false }).relay();
    await expect
      .poll(async () => (await storedAiJob(testApp.prisma, jobId)).status, SETTLED)
      .toMatch(/^(done|failed)$/);
    return storedAiJob(testApp.prisma, jobId);
  }

  return { call, requested, read, settled };
}

type AiRouteCalls = ReturnType<typeof applicationAiRoute>;

export type CachedRun = { caller: AiRouteCaller; worker: INestApplicationContext };

export async function postedTwice({ call }: AiRouteCalls, caller: AiRouteCaller) {
  const first = await call('post', caller);
  const second = await call('post', caller);
  const { jobId } = captureRetryResponseSchema.parse(first.body);
  return { first, second, jobId, requestId: first.get('x-request-id') };
}

export async function servedFromCache(route: AiRouteCalls, { caller, worker }: CachedRun) {
  const firstId = await route.requested(caller);
  const whileQueued = await route.read(caller);
  await worker.init();
  const first = await route.settled(worker, firstId);
  const secondId = await route.requested(caller);
  const second = await route.settled(worker, secondId);
  return { firstId, secondId, whileQueued, first, second };
}
