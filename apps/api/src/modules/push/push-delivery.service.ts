import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import {
  type DeliveryRule,
  type NotificationCreatedPayload,
  NotificationScheduleService,
} from '../notifications/index.js';
import { queuePushSend } from './push-jobs.js';
import { isPushed, isPushedType, type PushedNotification, pushMessageOf } from './push-message.js';

const PUSH_RULE: DeliveryRule<PushedNotification> = {
  delivers: isPushed,
  allowed: (settings) => settings.notifyPush,
};

@Injectable()
export class PushDeliveryService {
  constructor(
    private readonly schedules: NotificationScheduleService,
    @InjectQueue(QUEUES.push.name) private readonly queue: Queue,
  ) {}

  async schedule(created: NotificationCreatedPayload): Promise<void> {
    if (!isPushedType(created.type)) return;
    const due = await this.schedules.due(created, PUSH_RULE);
    if (due === null) return;
    const { notification, settings, deliverAt, delayMs } = due;
    const message = pushMessageOf(notification, { settings, deliverAt });
    const { userId, notificationId } = created;
    await queuePushSend(this.queue, { job: { userId, message }, notificationId, delayMs });
  }
}
