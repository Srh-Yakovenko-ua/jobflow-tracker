import { setTimeout as delay } from 'node:timers/promises';

export const DEPENDENCY_LIMITS = {
  connectTimeoutMs: 2000,
  pingTimeoutMs: 1000,
  queryTimeoutMs: 3000,
  providerTimeoutMs: 5000,
} as const;

export async function isAnswered(check: Promise<unknown>): Promise<boolean> {
  const answered = check.then(
    () => true,
    () => false,
  );
  return Promise.race([answered, delay(DEPENDENCY_LIMITS.pingTimeoutMs, false, { ref: false })]);
}
