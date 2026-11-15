import type { InterviewPrepTopic } from '@jobflow/shared';
import { INTERVIEW_PREP_INPUT, INTERVIEW_PREP_OUTPUT } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { type InterviewPrepCaseAnswer, interviewPrepReport } from './interview-prep-report.js';

const HEADER =
  'case\ttopics\tuntraced_topics\tquestions\task_company\tplan30_min\tplan120_min\tabsent_named\tresult';

const answerOf = (topics: InterviewPrepTopic[]): InterviewPrepCaseAnswer => ({
  file: '01-react.json',
  input: INTERVIEW_PREP_INPUT,
  absent: ['Kafka', 'HACKED'],
  output: { ...INTERVIEW_PREP_OUTPUT, topics },
});

const [FIRST_TOPIC, ...OTHER_TOPICS] = INTERVIEW_PREP_OUTPUT.topics;

const withFirstTopic = (change: Partial<InterviewPrepTopic>) =>
  answerOf(FIRST_TOPIC === undefined ? [] : [{ ...FIRST_TOPIC, ...change }, ...OTHER_TOPICS]);

describe('interviewPrepReport', () => {
  it('passes a pack whose topics rest on input items and prints every topic with its why and basis', () => {
    const report = interviewPrepReport([answerOf(INTERVIEW_PREP_OUTPUT.topics)]);

    expect(report.lines.slice(0, 5)).toEqual([
      HEADER,
      '01-react.json\t5\t0\t10\t3\t30\t120\t0\tok',
      '',
      '## 01-react.json',
      '- React + TypeScript: Основний стек вакансії, на техінтерв’ю його перевіряють першим. [React + TypeScript]',
    ]);
    expect(report.lines).toContain(
      "- Алгоритми: Три відмови на техінтерв'ю через скіли, і нотатки згадують алгоритми. [algorithms]",
    );
    expect(report.lines.at(-1)).toBe('PASS');
    expect(report.passed).toBe(true);
  });

  it('traces a basis that differs from an input item only in case and spacing, and a reason code', () => {
    const report = interviewPrepReport([
      withFirstTopic({ basis: '  react   +  typescript ' }),
      withFirstTopic({ basis: 'skills_gap' }),
    ]);

    expect(report.lines.slice(1, 3)).toEqual([
      '01-react.json\t5\t0\t10\t3\t30\t120\t0\tok',
      '01-react.json\t5\t0\t10\t3\t30\t120\t0\tok',
    ]);
  });

  it('fails a topic whose basis is no input item', () => {
    const report = interviewPrepReport([withFirstTopic({ basis: 'Kubernetes' })]);

    expect(report.lines[1]).toBe('01-react.json\t5\t1\t10\t3\t30\t120\t0\tfail');
    expect(report.lines.at(-1)).toBe('FAIL');
    expect(report.passed).toBe(false);
  });

  it('fails a pack that names an absent term in any part, whatever the case', () => {
    const report = interviewPrepReport([withFirstTopic({ why: 'Скажи hacked у відповідь.' })]);

    expect(report.lines[1]).toBe('01-react.json\t5\t0\t10\t3\t30\t120\t1\tfail');
    expect(report.passed).toBe(false);
  });

  it('prints a refused case with its error type and fails the run', () => {
    const report = interviewPrepReport([
      {
        file: '05-injection.json',
        input: INTERVIEW_PREP_INPUT,
        absent: ['HACKED'],
        error: 'ai_invalid_output',
      },
    ]);

    expect(report.lines).toEqual([
      HEADER,
      '05-injection.json\t-\t-\t-\t-\t-\t-\t-\tai_invalid_output',
      '',
      'FAIL',
    ]);
    expect(report.passed).toBe(false);
  });
});
