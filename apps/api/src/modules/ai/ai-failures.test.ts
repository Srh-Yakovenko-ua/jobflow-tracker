import { AI_KINDS } from '@jobflow/shared';
import { buildFollowupOutput, buildMatchOutput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { MATCH_OUTPUT } from '../../test/ai.js';
import { isFinal, OUTPUT_FAILURES } from './ai-failures.js';
import { AiServiceError } from './ai-service-error.js';

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

describe('OUTPUT_FAILURES.followup', () => {
  it('accepts every draft services/ai returned', () => {
    expect(OUTPUT_FAILURES.followup(buildFollowupOutput())).toBeNull();
  });
});

describe('isFinal', () => {
  const refusal = (status: number, type: string) => new AiServiceError({ status, type });

  it.each([
    { status: 504, type: 'ai_timeout' },
    { status: 503, type: 'not_ready' },
    { status: 429, type: 'rate_limited' },
  ])('gives up on a $status $type of a followup at once', ({ status, type }) => {
    expect(isFinal({ error: refusal(status, type), kind: 'followup' })).toBe(true);
  });

  it.each(AI_KINDS.filter((kind) => kind !== 'followup'))(
    'retries a 504 and a 429 of %s and gives up on its 422',
    (kind) => {
      expect([
        isFinal({ error: refusal(504, 'ai_timeout'), kind }),
        isFinal({ error: refusal(429, 'rate_limited'), kind }),
        isFinal({ error: refusal(422, 'ai_invalid_output'), kind }),
      ]).toEqual([false, false, true]);
    },
  );
});
