import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModuleBuilder } from '@nestjs/testing';

import { QUEUE_NAMES } from '../queues/queues.js';

export type StubJob = { id: string; name: string; data: unknown };

export class StubQueue {
  readonly jobs: StubJob[] = [];

  constructor(readonly name: string) {}

  add(name: string, data: unknown): Promise<StubJob> {
    const job = { id: `${this.name}-${String(this.jobs.length + 1)}`, name, data };
    this.jobs.push(job);
    return Promise.resolve(job);
  }

  on(): this {
    return this;
  }
}

export function stubQueues(builder: TestingModuleBuilder): TestingModuleBuilder {
  return QUEUE_NAMES.reduce(
    (stubbed, name) => stubbed.overrideProvider(getQueueToken(name)).useValue(new StubQueue(name)),
    builder,
  );
}
