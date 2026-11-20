import type { Notification, UserSettings } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { type ScheduledDelivery, scheduledDelivery } from '../../common/quiet-hours.js';
import { SettingsService } from '../settings/index.js';
import type { NotificationCreatedPayload } from './notifications.events.js';
import { NotificationsService } from './notifications.service.js';

export type DeliveryRule<Delivered extends Notification> = {
  delivers: (notification: Notification) => notification is Delivered;
  allowed: (settings: UserSettings, notification: Delivered) => boolean;
};

export type DueNotification<Delivered extends Notification> = ScheduledDelivery & {
  notification: Delivered;
  settings: UserSettings;
};

@Injectable()
export class NotificationScheduleService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  async due<Delivered extends Notification>(
    { userId, notificationId }: NotificationCreatedPayload,
    rule: DeliveryRule<Delivered>,
  ): Promise<DueNotification<Delivered> | null> {
    const notification = await this.notifications.find(userId, notificationId);
    if (notification === undefined || !rule.delivers(notification)) return null;
    const settings = await this.settings.get(userId);
    if (!rule.allowed(settings, notification)) return null;
    const now = this.clock.now();
    return { notification, settings, ...scheduledDelivery({ settings, notification, now }) };
  }
}
