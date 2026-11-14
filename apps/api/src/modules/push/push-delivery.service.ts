import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { Clock } from '../../common/clock.js';
import { withinLimit } from '../../common/probe.js';
import { quietHoursDeliveryAt } from '../../common/quiet-hours.js';
import { OUTBOX_LIMITS } from '../../outbox/outbox-relay.service.js';
import { QUEUES } from '../../queues/queues.js';
import { type NotificationCreatedPayload, NotificationsService } from '../notifications/index.js';
import { SettingsService } from '../settings/index.js';
import { isPushed, isPushedType, pushMessageOf } from './push-message.js';
import { PUSH_JOBS, type PushSendJob } from './push-send.service.js';

@Injectable()
export class PushDeliveryService {
  constructor(
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.push.name) private readonly queue: Queue,
    private readonly clock: Clock,
  ) {}

  async schedule({ userId, notificationId, type }: NotificationCreatedPayload): Promise<void> {
    if (!isPushedType(type)) return;
    const notification = await this.notifications.find(userId, notificationId);
    if (notification === undefined || !isPushed(notification)) return;
    const settings = await this.settings.get(userId);
    if (!settings.notifyPush) return;
    const now = this.clock.now();
    const deliverAt = quietHoursDeliveryAt({ settings, notification, now });
    const job: PushSendJob = { userId, message: pushMessageOf(notification, settings) };
    const options = { jobId: notificationId, delay: deliverAt.getTime() - now.getTime() };
    await withinLimit(this.queue.add(PUSH_JOBS.send, job, options), OUTBOX_LIMITS.publishTimeoutMs);
  }
}
