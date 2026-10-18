import { normalizeEmail } from '../auth/auth.service.js';

export function applicantEmail(email: string): string {
  return normalizeEmail(email);
}
