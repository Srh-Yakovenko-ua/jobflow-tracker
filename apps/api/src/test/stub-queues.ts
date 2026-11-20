import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModuleBuilder } from '@nestjs/testing';
import type { JobsOptions, QueueOptions } from 'bullmq';

import { QUEUE_NAMES, type QueueName } from '../queues/queues.js';

export type StubJob = { id: string; name: string; data: unknown };

export type StubBulkJob = { name: string; data: unknown; opts?: JobsOptions };

export type StubAdd = [name: string, data: unknown, opts?: StubBulkJob['opts']];

export type StubRetryableJob = { retry: (state: string) => Promise<void> };

const QUEUE_REFUSAL = 'Connection is closed.';

const refusal = (): Promise<never> => Promise.reject(new Error(QUEUE_REFUSAL));

export class StubQueue {
  readonly jobs: StubJob[] = [];

  readonly bulks: StubBulkJob[][] = [];

  readonly addOptions: JobsOptions[] = [];

  readonly opts: Partial<QueueOptions> = {};

  readonly retried: [id: string, state: string][] = [];

  readonly gone = new Set<string>();

  constructor(readonly name: string) {}

  getJob(id: string): Promise<StubRetryableJob | undefined> {
    const job = {
      retry: (state: string) => {
        this.retried.push([id, state]);
        return Promise.resolve();
      },
    };
    return Promise.resolve(this.gone.has(id) ? undefined : job);
  }

  add(...[name, data, opts = {}]: StubAdd): Promise<StubJob> {
    this.addOptions.push(opts);
    return Promise.resolve(this.record({ id: opts.jobId ?? this.nextId(), name, data }));
  }

  addBulk(jobs: StubBulkJob[]): Promise<StubJob[]> {
    this.bulks.push(jobs);
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

abstract class UnreachableQueue extends StubQueue {
  protected abstract unreachable(): Promise<never>;

  override add(): Promise<never> {
    return this.unreachable();
  }

  override addBulk(): Promise<never> {
    return this.unreachable();
  }

  override getJob(): Promise<never> {
    return this.unreachable();
  }
}

export class SilentQueue extends UnreachableQueue {
  protected unreachable(): Promise<never> {
    return new Promise<never>(() => undefined);
  }
}

export class RefusingQueue extends UnreachableQueue {
  protected unreachable(): Promise<never> {
    return refusal();
  }
}

export class RefusingOnceQueue extends StubQueue {
  private refused = false;

  override add(...job: StubAdd): Promise<StubJob> {
    if (this.refused) {
      return super.add(...job);
    }
    this.refused = true;
    return refusal();
  }
}

export const unreachableQueues = (name: string) => [
  { case: 'refuses it', queue: new RefusingQueue(name), error: QUEUE_REFUSAL },
  { case: 'never answers', queue: new SilentQueue(name), error: 'timed out after 2000 ms' },
];

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
