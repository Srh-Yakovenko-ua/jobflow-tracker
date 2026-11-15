import { z } from 'zod';

const httpUrl = z.url({ protocol: /^https?$/ });

const webConfigSchema = z.object({
  NEXT_PUBLIC_API_URL: httpUrl.default('http://localhost:4000'),
  NEXT_PUBLIC_ANALYTICS_URL: httpUrl.default('http://localhost:8000'),
  NEXT_PUBLIC_FILES_URL: httpUrl.default('http://localhost:9000'),
  NEXT_PUBLIC_SENTRY_DSN: httpUrl.optional(),
  NEXT_PUBLIC_SENTRY_RELEASE: z.string().optional(),
});

type WebEnv = Partial<Record<keyof z.input<typeof webConfigSchema>, string | undefined>>;

export type ErrorTrackingConfig = { dsn: string; release: string | undefined };

export type WebConfig = {
  apiUrl: string;
  apiBaseUrl: string;
  analyticsBaseUrl: string;
  filesUrl: string;
  errorTracking: ErrorTrackingConfig | undefined;
};

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

type ParsedWebEnv = z.output<typeof webConfigSchema>;

function errorTrackingOf(env: ParsedWebEnv): ErrorTrackingConfig | undefined {
  if (env.NEXT_PUBLIC_SENTRY_DSN === undefined) return undefined;
  return { dsn: env.NEXT_PUBLIC_SENTRY_DSN, release: env.NEXT_PUBLIC_SENTRY_RELEASE };
}

export function parseWebConfig(env: WebEnv): WebConfig {
  const present = Object.entries(env).filter(([, value]) => value !== '');
  const result = webConfigSchema.safeParse(Object.fromEntries(present));
  if (!result.success) {
    throw new Error(`Invalid web config:\n${z.prettifyError(result.error)}`);
  }
  const apiUrl = withoutTrailingSlash(result.data.NEXT_PUBLIC_API_URL);
  return {
    apiUrl,
    apiBaseUrl: `${apiUrl}/api/v1`,
    analyticsBaseUrl: withoutTrailingSlash(result.data.NEXT_PUBLIC_ANALYTICS_URL),
    filesUrl: withoutTrailingSlash(result.data.NEXT_PUBLIC_FILES_URL),
    errorTracking: errorTrackingOf(result.data),
  };
}

export const config = parseWebConfig({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_ANALYTICS_URL: process.env.NEXT_PUBLIC_ANALYTICS_URL,
  NEXT_PUBLIC_FILES_URL: process.env.NEXT_PUBLIC_FILES_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
});
