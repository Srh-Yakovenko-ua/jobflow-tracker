import {
  EMAIL_SETTING_OF,
  type EmailUnsubscribeInput,
  type EmailUnsubscribeResponse,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { SettingsService } from '../settings/index.js';
import { UnsubscribeTokens } from './unsubscribe-tokens.js';

@Injectable()
export class EmailUnsubscribeService {
  constructor(
    private readonly tokens: UnsubscribeTokens,
    private readonly settings: SettingsService,
  ) {}

  async unsubscribe({ token }: EmailUnsubscribeInput): Promise<EmailUnsubscribeResponse> {
    const { userId, type } = await this.tokens.verify(token);
    await this.settings.update(userId, { [EMAIL_SETTING_OF[type]]: false });
    return { type };
  }
}
