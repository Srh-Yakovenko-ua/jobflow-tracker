import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('keeps the last font size when a display token meets a text size', () => {
    expect(cn('text-display text-sm')).toBe('text-sm');
  });

  it('drops falsy parts and keeps the rest in order', () => {
    expect(cn('px-2', false, null, undefined, 'py-1')).toBe('px-2 py-1');
  });
});
