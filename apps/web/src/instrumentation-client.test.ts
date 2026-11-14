import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('instrumentation-client', () => {
  it('turns zod JIT off on the client, so no new Function probe meets the CSP', async () => {
    await import('./instrumentation-client');

    expect(z.config().jitless).toBe(true);
  });
});
