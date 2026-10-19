import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { type FactoryProvider, Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { QUEUE_NAMES, queueOptions } from './queues.js';

const QUEUE_ERROR_LOG = Symbol('QUEUE_ERROR_LOG');

const queueErrorLog: FactoryProvider<Logger> = {
  provide: QUEUE_ERROR_LOG,
  inject: QUEUE_NAMES.map((name) => getQueueToken(name)),
  useFactory: (...queues: Queue[]) => {
    const logger = new Logger('Queues');
    for (const queue of queues) {
      queue.on('error', (error: Error) => {
        logger.warn({ queue: queue.name, err: error.message }, 'queue connection error');
      });
    }
    return logger;
  },
};

const registeredQueues = BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name })));

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({ inject: [ConfigService], useFactory: queueOptions }),
    registeredQueues,
  ],
  providers: [queueErrorLog],
  exports: [registeredQueues],
})
export class QueuesModule {}
