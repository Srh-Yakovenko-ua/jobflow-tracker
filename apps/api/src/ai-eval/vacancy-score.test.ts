import type { VacancyParseOutput } from '@jobflow/shared';
import { buildVacancyParseOutput, vacancyFieldOf } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { VACANCY_EXPECTED, VACANCY_TEXT } from '../test/ai.js';
import type { VacancyExpected } from './vacancy-cases.js';
import { type VacancyCaseAnswer, vacancyReport } from './vacancy-score.js';

type AnswerOf = {
  file?: string;
  output?: Partial<VacancyParseOutput>;
  expected?: Partial<VacancyExpected>;
};

type RunOf = { misread: number; wrongStacks: number };

const CASES_IN_RUN = 10;

const MISREAD: Partial<VacancyParseOutput> = {
  company: vacancyFieldOf('Globex', 'Acme'),
  position: vacancyFieldOf('Designer', 'Senior'),
  salaryMin: vacancyFieldOf(400, '4000-5000 USD'),
};

function answerOf({ file = 'case.json', output = {}, expected = {} }: AnswerOf = {}) {
  return {
    file,
    expected: { ...VACANCY_EXPECTED, ...expected },
    output: buildVacancyParseOutput(output),
  } satisfies VacancyCaseAnswer;
}

function runOf({ misread, wrongStacks }: RunOf): VacancyCaseAnswer[] {
  return Array.from({ length: CASES_IN_RUN }, (_, index) =>
    answerOf({
      expected: { stack: ['React', 'Redux'] },
      output: {
        stack: vacancyFieldOf(
          index < CASES_IN_RUN - wrongStacks ? ['React', 'Redux'] : ['React', 'Vue'],
          'React',
        ),
        ...(index < CASES_IN_RUN - misread ? {} : MISREAD),
      },
    }),
  );
}

describe('vacancyReport', () => {
  it('prints the field table, the stack row, an empty misses list and PASS for a fully right case', () => {
    expect(vacancyReport([answerOf()])).toEqual({
      lines: [
        'field\tcases\tcorrect\taccuracy\twrong_exact',
        'company\t1\t1\t1.000\t0',
        'position\t1\t1\t1.000\t0',
        'seniority\t1\t1\t1.000\t0',
        'salaryMin\t1\t1\t1.000\t0',
        'salaryMax\t1\t1\t1.000\t0',
        'salary\t1\t1\t1.000\t0',
        'currency\t1\t1\t1.000\t0',
        'salaryTax\t1\t1\t1.000\t0',
        'location\t1\t1\t1.000\t0',
        'workMode\t1\t1\t1.000\t0',
        'englishLevel\t1\t1\t1.000\t0',
        'sourceGuess\t1\t1\t1.000\t0',
        'failure\t1\t1\t1.000\t0',
        '',
        'field\tcases\tprecision\trecall\tf1\twrong_exact',
        'stack\t1\t1.000\t1.000\t1.000\t0',
        '',
        'case\tfield\texpected\tgot\tconfidence',
        '',
        'threshold\tminimum\tactual\tresult',
        'company\t0.9\t1.000\tPASS',
        'position\t0.9\t1.000\tPASS',
        'salary\t0.9\t1.000\tPASS',
        'stackF1\t0.85\t1.000\tPASS',
        'PASS',
      ],
      passed: true,
    });
  });

  it('counts a wrong value as wrong_exact only while it is marked exact', () => {
    const { lines } = vacancyReport([
      answerOf(),
      answerOf({ output: { company: vacancyFieldOf('Globex', 'Acme') } }),
      answerOf({
        output: { company: { ...vacancyFieldOf('Initech', 'Acme'), confidence: 'check' } },
      }),
    ]);

    expect(lines).toEqual(
      expect.arrayContaining(['company\t3\t1\t0.333\t1', 'position\t3\t3\t1.000\t0']),
    );
  });

  it('counts the salary right only when salaryMin and salaryMax both are, whatever the currency', () => {
    const { lines } = vacancyReport([
      answerOf({
        output: {
          salaryMax: vacancyFieldOf(5500, '4000-5000 USD'),
          currency: vacancyFieldOf(null, null),
        },
      }),
      answerOf({ output: { currency: vacancyFieldOf(null, null) } }),
    ]);

    expect(lines).toEqual(
      expect.arrayContaining([
        'salaryMin\t2\t2\t1.000\t0',
        'salaryMax\t2\t1\t0.500\t1',
        'salary\t2\t1\t0.500\t1',
        'currency\t2\t0\t0.000\t0',
      ]),
    );
  });

  it('accepts any listed spelling of company, position and location, casefolded with the spaces collapsed', () => {
    const { lines } = vacancyReport([
      answerOf({
        expected: { company: ['Acme', 'Acme Inc.'], location: ['Київ', 'Kyiv'] },
        output: {
          company: vacancyFieldOf('  ACME   inc. ', 'Acme'),
          location: vacancyFieldOf('КИЇВ', 'Acme'),
        },
      }),
      answerOf({
        expected: { position: ['Senior React developer', 'React developer'] },
        output: { position: vacancyFieldOf('react  Developer', 'React developer') },
      }),
    ]);

    expect(lines).toEqual(
      expect.arrayContaining([
        'company\t2\t2\t1.000\t0',
        'position\t2\t2\t1.000\t0',
        'location\t2\t2\t1.000\t0',
      ]),
    );
  });

  it('computes the stack precision, recall and F1 over the casefolded items of all cases', () => {
    const { lines } = vacancyReport([
      answerOf({
        expected: { stack: ['React', 'TypeScript', 'Redux', 'Jest'] },
        output: { stack: vacancyFieldOf(['react ', 'TypeScript', 'Vue'], 'React') },
      }),
      answerOf({
        expected: { stack: ['Go'] },
        output: { stack: { ...vacancyFieldOf(['go'], 'React'), confidence: 'check' } },
      }),
    ]);

    expect(lines).toContain('stack\t2\t0.750\t0.600\t0.667\t1');
  });

  it('lists each wrong field with its expected value, the value got and its confidence, never the vacancy text', () => {
    const { lines } = vacancyReport([
      answerOf({
        file: '04-dou-en.json',
        output: {
          company: vacancyFieldOf('Globex', 'Acme'),
          stack: vacancyFieldOf(['React', 'Vue'], 'React'),
        },
      }),
    ]);

    expect(lines).toEqual(
      expect.arrayContaining([
        '04-dou-en.json\tcompany\tAcme\tGlobex\texact',
        '04-dou-en.json\tstack\tReact\tReact | Vue\texact',
      ]),
    );
    expect(lines.join('\n')).not.toContain(VACANCY_TEXT);
  });

  it('counts a case services/ai refused as wrong on every field and lists its error type once', () => {
    const refused: VacancyCaseAnswer = {
      file: '02.json',
      expected: VACANCY_EXPECTED,
      error: 'ai_invalid_output',
    };

    const { lines } = vacancyReport([answerOf({ file: '01.json' }), refused]);

    expect(lines).toEqual(
      expect.arrayContaining([
        'company\t2\t1\t0.500\t0',
        'failure\t2\t1\t0.500\t0',
        'stack\t2\t1.000\t0.500\t0.667\t0',
        '02.json\tall\t-\tai_invalid_output\t-',
      ]),
    );
    expect(lines.filter((line) => line.startsWith('02.json'))).toHaveLength(1);
  });

  it('scores the no_company_no_position failure through vacancyParseFailure', () => {
    const { lines } = vacancyReport([
      answerOf({
        expected: { company: null, position: null, failure: 'no_company_no_position' },
        output: { company: vacancyFieldOf(null, null), position: vacancyFieldOf(null, null) },
      }),
      answerOf({ expected: { failure: 'no_company_no_position' } }),
    ]);

    expect(lines).toEqual(
      expect.arrayContaining([
        'failure\t2\t1\t0.500\t0',
        'case.json\tfailure\tno_company_no_position\tnull\t-',
      ]),
    );
  });

  it('passes at exactly 0.9 on company, position and salary and 0.85 on the stack F1', () => {
    const { lines, passed } = vacancyReport(runOf({ misread: 1, wrongStacks: 3 }));

    expect(lines.slice(-5)).toEqual([
      'company\t0.9\t0.900\tPASS',
      'position\t0.9\t0.900\tPASS',
      'salary\t0.9\t0.900\tPASS',
      'stackF1\t0.85\t0.850\tPASS',
      'PASS',
    ]);
    expect(passed).toBe(true);
  });

  it('fails each threshold missed and ends on FAIL', () => {
    const { lines, passed } = vacancyReport(runOf({ misread: 2, wrongStacks: 4 }));

    expect(lines.slice(-5)).toEqual([
      'company\t0.9\t0.800\tFAIL',
      'position\t0.9\t0.800\tFAIL',
      'salary\t0.9\t0.800\tFAIL',
      'stackF1\t0.85\t0.800\tFAIL',
      'FAIL',
    ]);
    expect(passed).toBe(false);
  });
});
