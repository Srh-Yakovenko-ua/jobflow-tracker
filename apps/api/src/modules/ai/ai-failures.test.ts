import { AI_KINDS, type AiKind } from '@jobflow/shared';
import { buildFollowupOutput, buildMatchOutput, CV_HINTS_OUTPUT } from '@jobflow/shared/testing';
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

describe('OUTPUT_FAILURES.cv_hints', () => {
  it('accepts every guarded hint list services/ai returned', () => {
    expect(OUTPUT_FAILURES.cv_hints(CV_HINTS_OUTPUT)).toBeNull();
  });
});

const ON_DEMAND_KINDS: AiKind[] = ['followup', 'cv_hints'];

describe('isFinal', () => {
  const refusal = (status: number, type: string) => new AiServiceError({ status, type });

  it.each(
    ON_DEMAND_KINDS.flatMap((kind) => [
      { kind, status: 504, type: 'ai_timeout' },
      { kind, status: 503, type: 'not_ready' },
      { kind, status: 429, type: 'rate_limited' },
    ]),
  )('gives up on a $status $type of a $kind at once', ({ kind, status, type }) => {
    expect(isFinal({ error: refusal(status, type), kind })).toBe(true);
  });

  it.each(AI_KINDS.filter((kind) => !ON_DEMAND_KINDS.includes(kind)))(
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
