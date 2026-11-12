import { buildMatchOutput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { MATCH_OUTPUT } from '../../test/ai.js';
import { OUTPUT_FAILURES } from './ai-failures.js';

describe('OUTPUT_FAILURES.match', () => {
  it('fails a mapping with only mentioned requirements as no_requirements', () => {
    const mentionedOnly = buildMatchOutput({
      requirements: [{ name: 'Домен fintech', weight: 'mentioned', coverage: 'missing' }],
    });

    expect(OUTPUT_FAILURES.match(mentionedOnly)).toBe('no_requirements');
  });

  it('accepts a mapping with a must or nice requirement', () => {
    expect(OUTPUT_FAILURES.match(MATCH_OUTPUT)).toBeNull();
  });
});
