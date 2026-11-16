import { Injectable } from '@nestjs/common';

import { toUserSettings } from '../../prisma/user-settings-row.js';
import { NotificationsService } from '../notifications/index.js';
import { EmailRepository } from './email.repository.js';
import { EmailComposeService } from './email-compose.service.js';
import { isEmailed, isEmailOn } from './email-content.js';
import type { EmailSendJob } from './email-jobs.js';
import { EmailSender } from './email-sender.js';

export type EmailOutcome = 'sent' | 'skipped';

@Injectable()
export class EmailSendService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly repository: EmailRepository,
    private readonly composer: EmailComposeService,
    private readonly sender: EmailSender,
  ) {}

  async send({ userId, notificationId }: EmailSendJob): Promise<EmailOutcome> {
    const notification = await this.notifications.find(userId, notificationId);
    if (notification === undefined || !isEmailed(notification)) return 'skipped';
    const recipient = await this.repository.recipientOf(userId);
    if (recipient === null || recipient.settings === null) return 'skipped';
    const settings = toUserSettings(recipient.settings);
    if (!isEmailOn(settings, notification.type)) return 'skipped';
    const to = recipient.email;
    await this.sender.send(await this.composer.compose({ userId, to, notification, settings }));
    return 'sent';
  }
}
