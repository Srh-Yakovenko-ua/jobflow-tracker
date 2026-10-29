import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModuleBuilder } from '@nestjs/testing';

import { QUEUE_NAMES, type QueueName } from '../queues/queues.js';

export type StubJob = { id: string; name: string; data: unknown };

export type StubBulkJob = { name: string; data: unknown; opts?: { jobId?: string } };

export class StubQueue {
  readonly jobs: StubJob[] = [];

  constructor(readonly name: string) {}

  add(name: string, data: unknown): Promise<StubJob> {
    return Promise.resolve(this.record({ id: this.nextId(), name, data }));
  }

  addBulk(jobs: StubBulkJob[]): Promise<StubJob[]> {
    return Promise.resolve(
      jobs.map(({ name, data, opts }) =>
        this.record({ id: opts?.jobId ?? this.nextId(), name, data }),
      ),
    );
  }

  on(): this {
    return this;
  }

  private record(job: StubJob): StubJob {
    this.jobs.push(job);
    return job;
  }

  private nextId(): string {
    return `${this.name}-${String(this.jobs.length + 1)}`;
  }
}

export class HeldStubQueue extends StubQueue {
  private openGate: () => void = () => undefined;

  private markEntered: () => void = () => undefined;

  private readonly gate = new Promise<void>((resolve) => {
    this.openGate = resolve;
  });

  readonly entered = new Promise<void>((resolve) => {
    this.markEntered = resolve;
  });

  private holding = true;

  release(): void {
    this.openGate();
  }

  override async addBulk(jobs: StubBulkJob[]): Promise<StubJob[]> {
    if (this.holding) {
      this.holding = false;
      this.markEntered();
      await this.gate;
    }
    return super.addBulk(jobs);
  }
}

export function stubQueues(
  builder: TestingModuleBuilder,
  stubs: Partial<Record<QueueName, StubQueue>> = {},
): TestingModuleBuilder {
  return QUEUE_NAMES.reduce(
    (stubbed, name) =>
      stubbed.overrideProvider(getQueueToken(name)).useValue(stubs[name] ?? new StubQueue(name)),
    builder,
  );
}
