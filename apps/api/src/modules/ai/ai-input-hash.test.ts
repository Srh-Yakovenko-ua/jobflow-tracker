import { AI_PROMPT_VERSIONS } from '@jobflow/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { VACANCY_TEXT } from '../../test/ai.js';
import { aiInputHash } from './ai-input-hash.js';

const VACANCY = { kind: 'vacancy_parse', input: { text: VACANCY_TEXT } } as const;

const SHIPPED_VERSION = AI_PROMPT_VERSIONS.vacancy_parse;

afterEach(() => {
  AI_PROMPT_VERSIONS.vacancy_parse = SHIPPED_VERSION;
});

describe('aiInputHash', () => {
  it('answers a sha256 hex digest', () => {
    expect(aiInputHash(VACANCY)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    {
      case: 'the same vacancy pasted with extra spaces, tabs and newlines',
      input: { text: '  Senior React developer,\n\nAcme,\t remote,   4000-5000 USD \n' },
    },
    {
      case: 'the same city typed with a combining diaeresis',
      input: { text: 'Python developer, Київ' },
      other: { text: 'Python developer, Київ' },
    },
    {
      case: 'the same fields in another key order',
      input: { source: 'dou', text: VACANCY_TEXT },
      other: { text: VACANCY_TEXT, source: 'dou' },
    },
  ])('gives one key for $case', ({ input, other = VACANCY.input }) => {
    expect(aiInputHash({ kind: 'vacancy_parse', input })).toBe(
      aiInputHash({ kind: 'vacancy_parse', input: other }),
    );
  });

  it('gives another key for a different vacancy text', () => {
    const otherVacancy = { text: 'Junior Python developer, Smereka, office, 1500 USD' };

    expect(aiInputHash({ kind: 'vacancy_parse', input: otherVacancy })).not.toBe(
      aiInputHash(VACANCY),
    );
  });

  it('gives another key for the same text once the prompt version of the kind is bumped', () => {
    const before = aiInputHash(VACANCY);

    AI_PROMPT_VERSIONS.vacancy_parse = 'v3';

    expect(aiInputHash(VACANCY)).not.toBe(before);
  });
});
