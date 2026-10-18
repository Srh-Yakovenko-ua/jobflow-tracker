import { normalizeEmail } from '../auth/index.js';

export function noteAuthorEmail(email: string): string {
  return normalizeEmail(email);
}
