import { EventEmitter } from 'node:events';

import { WorkerHost } from '@nestjs/bullmq';

export class FakeWorker extends EventEmitter {
  constructor(readonly name: string) {
    super();
  }
}

export class FakeHost extends WorkerHost {
  process(): Promise<void> {
    return Promise.resolve();
  }
}

export function hostOf(worker: FakeWorker, host: FakeHost): FakeHost {
  Object.defineProperty(host, '_worker', { value: worker });
  return host;
}
