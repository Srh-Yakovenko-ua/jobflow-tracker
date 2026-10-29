import { z } from 'zod';

const httpUrl = z.url({ protocol: /^https?$/ });

const webConfigSchema = z.object({
  NEXT_PUBLIC_API_URL: httpUrl.default('http://localhost:4000'),
  NEXT_PUBLIC_ANALYTICS_URL: httpUrl.default('http://localhost:8000'),
});

type WebEnv = Partial<Record<keyof z.input<typeof webConfigSchema>, string | undefined>>;

export type WebConfig = { apiBaseUrl: string; analyticsBaseUrl: string };

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function parseWebConfig(env: WebEnv): WebConfig {
  const present = Object.entries(env).filter(([, value]) => value !== '');
  const result = webConfigSchema.safeParse(Object.fromEntries(present));
  if (!result.success) {
    throw new Error(`Invalid web config:\n${z.prettifyError(result.error)}`);
  }
  return {
    apiBaseUrl: `${withoutTrailingSlash(result.data.NEXT_PUBLIC_API_URL)}/api/v1`,
    analyticsBaseUrl: withoutTrailingSlash(result.data.NEXT_PUBLIC_ANALYTICS_URL),
  };
}

export const config = parseWebConfig({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_ANALYTICS_URL: process.env.NEXT_PUBLIC_ANALYTICS_URL,
});
