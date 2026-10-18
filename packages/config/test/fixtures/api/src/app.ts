import { normalizeEmail } from './modules/auth/auth.service.js';

export function signInEmail(email: string): string {
  return normalizeEmail(email);
}
