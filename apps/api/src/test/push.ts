import type { PushMessage, PushSubscriptionInput } from '@jobflow/shared';

import { FOLLOW_UP_HINT, silenceTitleOf } from '../modules/notifications/index.js';
import type { PushOutcome, PushTarget } from '../modules/push/index.js';
import { SILENCE_ITEM } from './notifications.js';

export type SentPush = { target: PushTarget; message: PushMessage };

export const PUSH_SUBSCRIPTIONS_PATH = '/api/v1/push/subscriptions';

export const PUSH_PUBLIC_KEY_PATH = '/api/v1/push/public-key';

export const pushSubscriptionPath = (id: string) => `${PUSH_SUBSCRIPTIONS_PATH}/${id}`;

export const CHROME_SUBSCRIPTION: PushSubscriptionInput = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/olena-chrome',
  keys: {
    p256dh: 'BOlenaChromeP256dhKey_olena-chrome',
    auth: 'OlenaChromeAuth',
  },
};

export const SILENCE_PUSH: PushMessage = {
  title: silenceTitleOf(SILENCE_ITEM),
  body: FOLLOW_UP_HINT,
  url: `/applications/${SILENCE_ITEM.applicationId}#follow-up`,
  tag: `application:${SILENCE_ITEM.applicationId}`,
};

export class ScriptedPushSender {
  enabled = true;

  publicKey: string | null = null;

  answer: PushOutcome = 'sent';

  readonly sent: SentPush[] = [];

  send(target: PushTarget, message: PushMessage): Promise<PushOutcome> {
    this.sent.push({ target, message });
    return Promise.resolve(this.answer);
  }
}
