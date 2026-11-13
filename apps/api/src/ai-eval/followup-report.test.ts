import { buildFollowupInput, buildFollowupOutput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { type FollowupCaseAnswer, followupReport } from './followup-report.js';

const INPUT = buildFollowupInput();

const SIXTY_WORDS = Array.from(
  { length: 60 },
  (_, index) => `слово${String.fromCharCode(1072 + (index % 26))}`,
).join(' ');

const answerOf = (file: string, body: string): FollowupCaseAnswer => ({
  file,
  input: INPUT,
  output: buildFollowupOutput({ subject: 'Співбесіда 3 вересня', body }),
});

describe('followupReport', () => {
  it('passes drafts of 60 to 120 words whose numbers all come from the input, and prints them', () => {
    const report = followupReport([answerOf('01-uk.json', `${SIXTY_WORDS} — 6 днів`)]);

    expect(report.lines).toEqual([
      'case\twords\tinvented_numbers\tresult',
      '01-uk.json\t62\t-\tok',
      '',
      '## 01-uk.json',
      'Співбесіда 3 вересня',
      `${SIXTY_WORDS} — 6 днів`,
      '',
      'PASS',
    ]);
    expect(report.passed).toBe(true);
  });

  it.each([
    {
      case: 'a draft of 59 words',
      body: SIXTY_WORDS.split(' ').slice(1).join(' '),
      row: '59\t-\twords',
    },
    {
      case: 'a draft of 121 words',
      body: `${SIXTY_WORDS} ${SIXTY_WORDS} ще`,
      row: '121\t-\twords',
    },
    {
      case: 'a number the input never gave',
      body: `${SIXTY_WORDS} через 14 днів, о 10`,
      row: '65\t14 10\tnumbers',
    },
  ])('fails $case', ({ body, row }) => {
    const report = followupReport([answerOf('02-en.json', body)]);

    expect(report.lines[1]).toBe(`02-en.json\t${row}`);
    expect(report.lines.at(-1)).toBe('FAIL');
    expect(report.passed).toBe(false);
  });

  it('fails a refused case with its error and prints no draft for it', () => {
    const report = followupReport([
      { file: '03-uk.json', input: INPUT, error: 'ai_invalid_output' },
    ]);

    expect(report.lines).toEqual([
      'case\twords\tinvented_numbers\tresult',
      '03-uk.json\t-\t-\tai_invalid_output',
      '',
      'FAIL',
    ]);
    expect(report.passed).toBe(false);
  });
});
