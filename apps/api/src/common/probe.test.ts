import { describe, expect, it } from 'vitest';

import { isAnswered, withinLimit } from './probe.js';

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

describe('withinLimit', () => {
  it('resolves with the value of work that answers in time', async () => {
    await expect(withinLimit(Promise.resolve('PONG'), 50)).resolves.toBe('PONG');
  });

  it('rejects once the limit passes for work that never settles', async () => {
    await expect(withinLimit(new Promise(() => undefined), 20)).rejects.toThrow(
      'timed out after 20 ms',
    );
  });
});
