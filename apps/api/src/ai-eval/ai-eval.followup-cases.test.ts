import { fileURLToPath } from 'node:url';

import { FOLLOWUP_LANGUAGES, FOLLOWUP_TONES } from '@jobflow/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { type FollowupEvalCase, loadFollowupCases } from './followup-cases.js';

const CASES_DIR = fileURLToPath(new URL('../modules/ai/evals/followup', import.meta.url));

describe('the followup eval cases', () => {
  let cases: FollowupEvalCase[];

  beforeAll(async () => {
    cases = await loadFollowupCases(CASES_DIR);
  });

  it('parses 10 synthetic inputs that cover both languages and all three tones', () => {
    expect(cases).toHaveLength(10);
    expect(new Set(cases.map(({ language }) => language))).toEqual(new Set(FOLLOWUP_LANGUAGES));
    expect(new Set(cases.map(({ tone }) => tone))).toEqual(new Set(FOLLOWUP_TONES));
  });

  it.each(['recruiterFirstName', 'lastInterview', 'senderName', 'hint'] as const)(
    'includes cases with and without %s',
    (field) => {
      const missing = cases.filter((evalCase) => evalCase[field] === null).length;

      expect([missing > 0, missing < cases.length]).toEqual([true, true]);
    },
  );
});
