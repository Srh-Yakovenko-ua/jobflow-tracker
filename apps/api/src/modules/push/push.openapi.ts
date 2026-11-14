import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  PUSH_LIMITS,
  pushPublicKeySchema,
  pushSubscriptionCreatedSchema,
  type PushSubscriptionInput,
  pushSubscriptionInputSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, jsonContent } from '../../openapi/route.js';

const TAGS = ['push'];

const SUBSCRIPTIONS_PATH = '/push/subscriptions';

const EXAMPLE_SUBSCRIPTION_ID = '0199f6c2-4d5e-7f60-8a71-8b9c0d1e2f3a';

const SUBSCRIPTION: PushSubscriptionInput = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH',
  keys: {
    p256dh:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};

const subscriptionParams = z.object({
  id: pushSubscriptionCreatedSchema.shape.id.meta({ example: EXAMPLE_SUBSCRIPTION_ID }),
});

export const PUSH_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/push/public-key',
    tags: TAGS,
    summary: 'Read the VAPID public key for PushManager.subscribe',
    description: 'publicKey is null while push is off, that is while the API has no VAPID keys.',
    responses: {
      200: {
        description: 'The VAPID public key, base64url',
        content: jsonContent(pushPublicKeySchema, {
          publicKey:
            'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        }),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'post',
    path: SUBSCRIPTIONS_PATH,
    tags: TAGS,
    summary: 'Save the push subscription of this browser',
    description: `Keyed by endpoint: a known endpoint gets the new keys, the signed-in user and a reset failure count. The endpoint is https on a browser push service (FCM, Mozilla, Apple, Windows). The User-Agent header is kept, cut to ${String(PUSH_LIMITS.userAgentMax)} characters.`,
    request: {
      body: { required: true, content: jsonContent(pushSubscriptionInputSchema, SUBSCRIPTION) },
    },
    responses: {
      201: {
        description: 'The id of the saved subscription',
        content: jsonContent(pushSubscriptionCreatedSchema, { id: EXAMPLE_SUBSCRIPTION_ID }),
      },
      ...errorResponses([400, 401, 403, 422]),
    },
  },
  {
    method: 'delete',
    path: `${SUBSCRIPTIONS_PATH}/{id}`,
    tags: TAGS,
    summary: 'Delete a push subscription',
    request: { params: subscriptionParams },
    responses: {
      204: { description: 'The subscription is deleted' },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
];
