import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import {
  type DeliveryRule,
  type NotificationCreatedPayload,
  NotificationScheduleService,
} from '../notifications/index.js';
import { type EmailedNotification, isEmailed, isEmailedType, isEmailOn } from './email-content.js';
import { queueEmailSend } from './email-jobs.js';

const EMAIL_RULE: DeliveryRule<EmailedNotification> = {
  delivers: isEmailed,
  allowed: (settings, notification) => isEmailOn(settings, notification.type),
};

@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly schedules: NotificationScheduleService,
    @InjectQueue(QUEUES.notifications.name) private readonly queue: Queue,
  ) {}

  async schedule(created: NotificationCreatedPayload): Promise<void> {
    if (!isEmailedType(created.type)) return;
    const due = await this.schedules.due(created, EMAIL_RULE);
    if (due === null) return;
    const { userId, notificationId } = created;
    await queueEmailSend(this.queue, { job: { userId, notificationId }, delayMs: due.delayMs });
  }
}
