import { z } from 'zod';

export const AI_PROVIDERS = ['fake', 'anthropic', 'openai'] as const;

const httpUrl = z.url({ protocol: /^https?$/ });
const requiredText = z.string().min(1);

export const envSchema = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    S3_ENDPOINT: z.url(),
    S3_BUCKET: requiredText,
    S3_ACCESS_KEY: requiredText,
    S3_SECRET_KEY: requiredText,
    JWT_PRIVATE_KEY_PATH: requiredText,
    JWT_PUBLIC_KEY_PATH: requiredText,
    API_URL: httpUrl,
    WEB_ORIGIN: httpUrl,
    AI_PROVIDER: z.enum(AI_PROVIDERS).default('fake'),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    AI_DAILY_LIMIT: z.coerce.number().int().positive().default(50),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    SMTP_URL: z.url({ protocol: /^smtps?$/ }),
    SENTRY_DSN: z.url().optional(),
    MIXPANEL_TOKEN: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.AI_PROVIDER === 'fake') {
      return;
    }
    for (const key of ['AI_API_KEY', 'AI_MODEL'] as const) {
      if (env[key] === undefined) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `Required when AI_PROVIDER is ${env.AI_PROVIDER}`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv) {
  const present = Object.entries(source).filter(([, value]) => value !== '');
  return envSchema.safeParse(Object.fromEntries(present));
}

export function loadEnv(source: NodeJS.ProcessEnv): Readonly<Env> {
  const result = parseEnv(source);
  if (result.success) {
    return Object.freeze(result.data);
  }
  process.stderr.write(`Invalid environment:\n${z.prettifyError(result.error)}\n`);
  return process.exit(1);
}
