import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { Env } from '../../config/env.js';
import { QUEUES } from '../../queues/queues.js';
import { MAINTENANCE_SCHEDULES, UPTIME_PUSH_SCHEDULE } from './maintenance.jobs.js';

@Injectable()
export class MaintenanceScheduler implements OnApplicationBootstrap {
  private readonly uptimePushUrl: string | undefined;

  constructor(
    @InjectQueue(QUEUES.maintenance.name) private readonly queue: Queue,
    config: ConfigService<Env, true>,
  ) {
    this.uptimePushUrl = config.get('UPTIME_KUMA_PUSH_URL', { infer: true }) || undefined;
  }

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all(
      Object.entries(MAINTENANCE_SCHEDULES).map(([id, { repeat, template }]) =>
        this.queue.upsertJobScheduler(id, repeat, template),
      ),
    );
    await this.scheduleUptimePush();
  }

  private async scheduleUptimePush(): Promise<void> {
    const { id, repeat, template } = UPTIME_PUSH_SCHEDULE;
    if (this.uptimePushUrl === undefined) {
      await this.queue.removeJobScheduler(id);
      return;
    }
    await this.queue.upsertJobScheduler(id, repeat, {
      ...template,
      data: { url: this.uptimePushUrl },
    });
  }
}
