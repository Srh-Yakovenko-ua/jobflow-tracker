import { z } from 'zod';

export const PUSH_LIMITS = {
  endpointMax: 2048,
  userAgentMax: 256,
  p256dhMax: 128,
  authMax: 32,
  subscriptionsPerUser: 10,
} as const;

const PUSH_SERVICE_HOST =
  /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;

export const pushSubscriptionInputSchema = z.object({
  endpoint: z
    .url({ protocol: /^https$/, hostname: PUSH_SERVICE_HOST })
    .max(PUSH_LIMITS.endpointMax),
  keys: z.object({
    p256dh: z.base64url().min(1).max(PUSH_LIMITS.p256dhMax),
    auth: z.base64url().min(1).max(PUSH_LIMITS.authMax),
  }),
});

export const pushSubscriptionCreatedSchema = z.object({ id: z.uuid() });

export const pushPublicKeySchema = z.object({ publicKey: z.string().min(1).nullable() });

export const pushMessageSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().regex(/^\/(?!\/)/),
  tag: z.string().min(1),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;
export type PushSubscriptionCreated = z.infer<typeof pushSubscriptionCreatedSchema>;
export type PushPublicKey = z.infer<typeof pushPublicKeySchema>;
export type PushMessage = z.infer<typeof pushMessageSchema>;
