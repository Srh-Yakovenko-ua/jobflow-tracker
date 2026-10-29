import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import { MAINTENANCE_SCHEDULES } from './maintenance.jobs.js';

@Injectable()
export class MaintenanceScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(QUEUES.maintenance.name) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all(
      MAINTENANCE_SCHEDULES.map(({ id, repeat, template }) =>
        this.queue.upsertJobScheduler(id, repeat, template),
      ),
    );
  }
}
