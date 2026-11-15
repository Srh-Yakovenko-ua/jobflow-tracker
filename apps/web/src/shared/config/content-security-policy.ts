import { config, type WebConfig } from './web-config';

export type ContentSecurityPolicyInput = {
  nonce: string;
  dev: boolean;
  origins: readonly string[];
};

export function buildContentSecurityPolicy({
  nonce,
  dev,
  origins,
}: ContentSecurityPolicyInput): string {
  const directives: Record<string, readonly string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...origins.map((url) => new URL(url).origin)],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'worker-src': ["'self'"],
  };
  return Object.entries(directives)
    .map(([directive, sources]) => [directive, ...sources].join(' '))
    .join('; ');
}

export function connectOrigins(web: WebConfig): string[] {
  const reportOrigins = web.errorTracking ? [web.errorTracking.dsn] : [];
  return [web.apiUrl, web.analyticsBaseUrl, web.filesUrl, ...reportOrigins];
}

export function contentSecurityPolicy(nonce: string): string {
  return buildContentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    origins: connectOrigins(config),
  });
}
