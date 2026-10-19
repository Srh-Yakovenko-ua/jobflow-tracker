import { describe, expect, it } from 'vitest';

import { isAnswered } from './probe.js';

describe('isAnswered', () => {
  it('is true when the check resolves', async () => {
    await expect(isAnswered(Promise.resolve('PONG'))).resolves.toBe(true);
  });

  it('is false when the check rejects', async () => {
    await expect(isAnswered(Promise.reject(new Error('refused')))).resolves.toBe(false);
  });

  it('is false when the check outlasts the ping timeout', async () => {
    await expect(isAnswered(new Promise(() => undefined))).resolves.toBe(false);
  });
});
