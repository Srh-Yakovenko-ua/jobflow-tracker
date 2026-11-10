import { describe, expect, it } from 'vitest';

import { createListeners } from './listeners';

describe('createListeners', () => {
  it('calls every subscribed listener on notify and skips one that unsubscribed', () => {
    const listeners = createListeners();
    const calls: string[] = [];
    const unsubscribe = listeners.subscribe(() => {
      calls.push('first');
    });
    listeners.subscribe(() => {
      calls.push('second');
    });

    listeners.notify();
    unsubscribe();
    listeners.notify();

    expect(calls).toEqual(['first', 'second', 'second']);
  });
});
