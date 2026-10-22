import { createHash } from 'node:crypto';

import type { Request } from 'express';
import { z } from 'zod';

import type { Env } from '../config/env.js';

export type RateLimitedRequest = Pick<Request, 'ip' | 'body' | 'user'>;

type RateLimitEnvKey = Extract<keyof Env, `RATE_LIMIT_${string}`>;

type RateLimitPolicyDefinition = {
  envKey: RateLimitEnvKey;
  durationSeconds: number;
  keyOf: (req: RateLimitedRequest) => string;
};

const WINDOW_SECONDS = { minute: 60, hour: 3600 } as const;

const emailInBody = z.object({ email: z.string() });

const clientIp = (req: RateLimitedRequest): string => req.ip ?? '';

const callerKey = (req: RateLimitedRequest): string => req.user?.id ?? clientIp(req);

function loginKey(req: RateLimitedRequest): string {
  const parsed = emailInBody.safeParse(req.body);
  const email = parsed.success ? parsed.data.email.toLowerCase() : '';
  return `${clientIp(req)}:${createHash('sha256').update(email).digest('hex')}`;
}

export const RATE_LIMIT_POLICIES = {
  login: {
    envKey: 'RATE_LIMIT_LOGIN_PER_MINUTE',
    durationSeconds: WINDOW_SECONDS.minute,
    keyOf: loginKey,
  },
  register: {
    envKey: 'RATE_LIMIT_REGISTER_PER_HOUR',
    durationSeconds: WINDOW_SECONDS.hour,
    keyOf: clientIp,
  },
  ai: { envKey: 'RATE_LIMIT_AI_PER_HOUR', durationSeconds: WINDOW_SECONDS.hour, keyOf: callerKey },
  capture: {
    envKey: 'RATE_LIMIT_CAPTURE_PER_HOUR',
    durationSeconds: WINDOW_SECONDS.hour,
    keyOf: callerKey,
  },
  api: {
    envKey: 'RATE_LIMIT_API_PER_MINUTE',
    durationSeconds: WINDOW_SECONDS.minute,
    keyOf: callerKey,
  },
} as const satisfies Record<string, RateLimitPolicyDefinition>;

export type RateLimitPolicy = keyof typeof RATE_LIMIT_POLICIES;

export const DEFAULT_RATE_LIMIT_POLICY = 'api' satisfies RateLimitPolicy;
