import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { Clock } from '../../common/clock.js';
import { scheduledDelivery } from '../../common/quiet-hours.js';
import { QUEUES } from '../../queues/queues.js';
import { type NotificationCreatedPayload, NotificationsService } from '../notifications/index.js';
import { SettingsService } from '../settings/index.js';
import { isEmailed, isEmailedType, isEmailOn } from './email-content.js';
import { queueEmailSend } from './email-jobs.js';

@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.notifications.name) private readonly queue: Queue,
    private readonly clock: Clock,
  ) {}

  async schedule({ userId, notificationId, type }: NotificationCreatedPayload): Promise<void> {
    if (!isEmailedType(type)) return;
    const notification = await this.notifications.find(userId, notificationId);
    if (notification === undefined || !isEmailed(notification)) return;
    const settings = await this.settings.get(userId);
    if (!isEmailOn(settings, notification.type)) return;
    const now = this.clock.now();
    const { delayMs } = scheduledDelivery({ settings, notification, now });
    await queueEmailSend(this.queue, { job: { userId, notificationId }, delayMs });
  }
}
