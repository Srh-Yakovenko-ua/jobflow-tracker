import type { CvHint } from '@jobflow/shared';
import { CV_HINTS_INPUT, CV_HINTS_OUTPUT } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { type CvHintsCaseAnswer, cvHintsReport } from './cv-hints-report.js';

const HEADER = 'case\thints\tevidence_not_in_cv\tforeign_requirement\tabsent_named\tresult';

const [GRAPHQL_HINT] = CV_HINTS_OUTPUT.hints;

const answerOf = (hints: CvHint[]): CvHintsCaseAnswer => ({
  file: '01-graphql.json',
  input: CV_HINTS_INPUT,
  absent: ['AWS', 'Kubernetes'],
  output: { ...CV_HINTS_OUTPUT, hints },
});

const withHint = (change: Partial<CvHint>) =>
  answerOf(CV_HINTS_OUTPUT.hints.map((hint) => ({ ...hint, ...change })));

describe('cvHintsReport', () => {
  it('passes hints that quote the CV profile for a partial requirement, and prints the hints and gaps', () => {
    const report = cvHintsReport([answerOf(CV_HINTS_OUTPUT.hints)]);

    expect(report.lines).toEqual([
      HEADER,
      '01-graphql.json\t1\t0\t0\t0\tok',
      '',
      '## 01-graphql.json',
      `- GraphQL (до +5): ${GRAPHQL_HINT?.suggestion ?? ''}`,
      '  CV: Built the Acme dashboard in React',
      'gaps: AWS / інфраструктура; Досвід ліда команди 3+',
      '',
      'PASS',
    ]);
    expect(report.passed).toBe(true);
  });

  it('accepts evidence and a requirement that differ from the profile only in case and spacing', () => {
    const report = cvHintsReport([
      withHint({ evidenceInCv: '  built the ACME   dashboard in react ', requirement: 'graphql ' }),
    ]);

    expect(report.lines[1]).toBe('01-graphql.json\t1\t0\t0\t0\tok');
  });

  it.each([
    {
      case: 'evidence the CV profile does not hold',
      change: { evidenceInCv: 'Ran the AWS migration of the Acme dashboard' },
      row: '1\t1\t0\t1\tfail',
    },
    {
      case: 'a requirement the CV already fully covers',
      change: { requirement: 'Node.js у проді' },
      row: '1\t0\t1\t0\tfail',
    },
    {
      case: 'a missing requirement',
      change: { requirement: 'AWS / інфраструктура' },
      row: '1\t0\t1\t1\tfail',
    },
    {
      case: 'a requirement the input never named',
      change: { requirement: 'Rust' },
      row: '1\t0\t1\t0\tfail',
    },
    {
      case: 'a suggestion that names an absent term',
      change: { suggestion: 'Додай рядок про розгортання дашборду в kubernetes.' },
      row: '1\t0\t0\t1\tfail',
    },
  ])('fails a hint with $case', ({ change, row }) => {
    const report = cvHintsReport([withHint(change)]);

    expect(report.lines[1]).toBe(`01-graphql.json\t${row}`);
    expect(report.lines.at(-1)).toBe('FAIL');
    expect(report.passed).toBe(false);
  });

  it('passes a case with no hints and fails a refused case with its error, printing nothing for it', () => {
    const report = cvHintsReport([
      answerOf([]),
      {
        file: '02-kafka.json',
        input: CV_HINTS_INPUT,
        absent: ['Kafka'],
        error: 'ai_invalid_output',
      },
    ]);

    expect(report.lines.slice(0, 3)).toEqual([
      HEADER,
      '01-graphql.json\t0\t0\t0\t0\tok',
      '02-kafka.json\t-\t-\t-\t-\tai_invalid_output',
    ]);
    expect(report.lines.filter((line) => line.startsWith('## '))).toEqual(['## 01-graphql.json']);
    expect(report.passed).toBe(false);
  });
});
