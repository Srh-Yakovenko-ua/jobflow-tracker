import { z } from 'zod';

const httpUrl = z.url({ protocol: /^https?$/ });
const requiredText = z.string().min(1);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  S3_ENDPOINT: z.url(),
  S3_BUCKET: requiredText,
  S3_ACCESS_KEY: requiredText,
  S3_SECRET_KEY: requiredText,
  JWT_PRIVATE_KEY_PATH: requiredText,
  JWT_PUBLIC_KEY_PATH: requiredText,
  API_URL: httpUrl,
  HOST: z.union([z.ipv4(), z.ipv6()]).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: httpUrl,
  AI_SERVICE_URL: httpUrl.default('http://localhost:8001'),
  AI_DAILY_LIMIT: z.coerce.number().int().positive().default(50),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  SENTRY_DSN: z.url().optional(),
  MIXPANEL_TOKEN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>) {
  const present = Object.entries(source).filter(([, value]) => value !== '');
  return envSchema.safeParse(Object.fromEntries(present));
}

function describeEnvError(error: z.ZodError) {
  return `Invalid environment:\n${z.prettifyError(error)}`;
}

export function validateEnv(source: Record<string, unknown>): Env {
  const result = parseEnv(source);
  if (result.success) {
    return result.data;
  }
  throw new Error(describeEnvError(result.error));
}

export function loadEnv(source: NodeJS.ProcessEnv): Readonly<Env> {
  const result = parseEnv(source);
  if (result.success) {
    return Object.freeze(result.data);
  }
  process.stderr.write(`${describeEnvError(result.error)}\n`);
  return process.exit(1);
}
