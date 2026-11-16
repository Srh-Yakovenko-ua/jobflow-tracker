import type { UserSettings } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Clock } from '../../common/clock.js';
import type { Env } from '../../config/env.js';
import { SummariesService } from '../summaries/index.js';
import { emailContentOf, type EmailedNotification, unsubscribeUrlOf } from './email-content.js';
import type { OutgoingEmail } from './email-sender.js';
import { renderHtml, renderText } from './email-template.js';
import { UnsubscribeTokens } from './unsubscribe-tokens.js';

export type EmailRecipient = {
  userId: string;
  to: string;
  notification: EmailedNotification;
  settings: UserSettings;
};

@Injectable()
export class EmailComposeService {
  constructor(
    private readonly summaries: SummariesService,
    private readonly tokens: UnsubscribeTokens,
    private readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async compose({ userId, to, notification, settings }: EmailRecipient): Promise<OutgoingEmail> {
    const now = this.clock.now();
    const webOrigin = this.config.get('WEB_ORIGIN', { infer: true });
    const summary =
      notification.type === 'monthly_summary_ready'
        ? await this.summaries.find(userId, notification.payload.aiJobId)
        : null;
    const content = emailContentOf(notification, { summary, settings, webOrigin, now });
    const token = await this.tokens.sign({ userId, type: notification.type, issuedAt: now });
    const unsubscribeUrl = unsubscribeUrlOf(webOrigin, token);
    const letter = { content, unsubscribeUrl };
    const html = await renderHtml(letter);
    return { to, subject: content.subject, html, text: renderText(letter), unsubscribeUrl };
  }
}
