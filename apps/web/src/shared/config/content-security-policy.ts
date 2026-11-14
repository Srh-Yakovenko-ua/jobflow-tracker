import { config } from './web-config';

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
  };
  return Object.entries(directives)
    .map(([directive, sources]) => [directive, ...sources].join(' '))
    .join('; ');
}

export function contentSecurityPolicy(nonce: string): string {
  return buildContentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    origins: [config.apiUrl, config.analyticsBaseUrl, config.filesUrl],
  });
}
