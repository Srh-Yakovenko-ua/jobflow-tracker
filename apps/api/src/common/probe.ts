import { setTimeout as delay } from 'node:timers/promises';

export const DEPENDENCY_LIMITS = {
  connectTimeoutMs: 2000,
  pingTimeoutMs: 1000,
  queryTimeoutMs: 3000,
  providerTimeoutMs: 5000,
  aiServiceTimeoutMs: 65_000,
} as const;

export async function isAnswered(check: Promise<unknown>): Promise<boolean> {
  const answered = check.then(
    () => true,
    () => false,
  );
  return Promise.race([answered, delay(DEPENDENCY_LIMITS.pingTimeoutMs, false, { ref: false })]);
}

export async function withinLimit<T>(work: Promise<T>, limitMs: number): Promise<T> {
  const timedOut = delay(limitMs, undefined, { ref: false }).then((): never => {
    throw new Error(`timed out after ${String(limitMs)} ms`);
  });
  return Promise.race([work, timedOut]);
}
