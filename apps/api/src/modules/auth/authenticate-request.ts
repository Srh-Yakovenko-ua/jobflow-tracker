import { AppError, unauthorized } from '../../common/app-error.js';
import type { AccessUser } from './access-tokens.js';
import type { Credentials, CredentialsService } from './credentials.service.js';
import type { HttpExchange } from './refresh-cookie.js';

const CREDENTIALS = /^(Bearer|Capture)\s+(\S+)$/i;

const CHALLENGE = {
  missing: 'Bearer',
  bearer: 'Bearer error="invalid_token"',
  capture: 'Capture error="invalid_token"',
} as const;

function credentialsOf(header: string | undefined): Credentials | undefined {
  const [, scheme, token] = CREDENTIALS.exec(header ?? '') ?? [];
  if (scheme === undefined || token === undefined) {
    return undefined;
  }
  return { scheme: scheme.toLowerCase() === 'capture' ? 'capture' : 'bearer', token };
}

export async function authenticateRequest(
  verifier: CredentialsService,
  { req, res }: HttpExchange,
): Promise<AccessUser> {
  res.set('Cache-Control', 'no-store');
  const credentials = credentialsOf(req.get('authorization'));
  if (credentials === undefined) {
    res.set('WWW-Authenticate', CHALLENGE.missing);
    throw unauthorized('Missing access token');
  }
  try {
    return await verifier.verify(credentials);
  } catch (error) {
    if (error instanceof AppError && error.status === 401) {
      res.set('WWW-Authenticate', CHALLENGE[credentials.scheme]);
    }
    throw error;
  }
}
