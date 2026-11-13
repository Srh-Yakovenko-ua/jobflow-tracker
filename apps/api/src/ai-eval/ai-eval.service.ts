import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  AI_JOB_FAILURES,
  followupOutputSchema,
  matchOutputSchema,
  type ResumeParseOutput,
  resumeParseOutputSchema,
  vacancyParseOutputSchema,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Clock } from '../common/clock.js';
import { ServiceCallError } from '../common/service-call-error.js';
import { AI_PAYLOAD_BUILDERS, AiClient } from '../modules/ai/index.js';
import { scoreMatch } from '../modules/match/index.js';
import { detectResumeFormat, DocumentsClient } from '../modules/resumes/index.js';
import type { EvalReport } from './eval-cases.js';
import { type FollowupEvalCase, loadFollowupCases } from './followup-cases.js';
import { type FollowupCaseAnswer, followupReport } from './followup-report.js';
import { loadMatchCases, type MatchEvalCase } from './match-cases.js';
import { type MatchCaseAnswer, matchReport } from './match-report.js';
import { loadResumeCases, type ResumeEvalCase } from './resume-cases.js';
import { type ResumeCaseAnswer, resumeReport } from './resume-score.js';
import { loadVacancyCases, type VacancyEvalCase } from './vacancy-cases.js';
import { type VacancyCaseAnswer, vacancyReport } from './vacancy-score.js';

const RUN_STOPPERS = new Set<string>([
  AI_JOB_FAILURES.notReady,
  AI_JOB_FAILURES.timeout,
  'documents_timeout',
]);

type Stopped = { stoppedBy: string };

type Refusal = { error: string } | Stopped;

const isStopped = (outcome: object): outcome is Stopped => 'stoppedBy' in outcome;

function refusalOf(error: unknown): Refusal {
  if (!(error instanceof ServiceCallError)) {
    throw error;
  }
  return RUN_STOPPERS.has(error.type) ? { stoppedBy: error.type } : { error: error.type };
}

@Injectable()
export class AiEvalService {
  constructor(
    private readonly ai: AiClient,
    private readonly documents: DocumentsClient,
    private readonly clock: Clock,
  ) {}

  async vacancy(casesDir: string): Promise<EvalReport> {
    const cases = await loadVacancyCases(casesDir);
    const answers = await this.answerAll(cases, (evalCase) => this.vacancyAnswer(evalCase));
    return Array.isArray(answers) ? vacancyReport(answers) : answers;
  }

  async match(casesDir: string): Promise<EvalReport> {
    const cases = await loadMatchCases(casesDir);
    const answers = await this.answerAll(cases, (evalCase) => this.matchAnswer(evalCase));
    return Array.isArray(answers) ? matchReport(answers) : answers;
  }

  async followup(casesDir: string): Promise<EvalReport> {
    const cases = await loadFollowupCases(casesDir);
    const answers = await this.answerAll(cases, (evalCase) => this.followupAnswer(evalCase));
    return Array.isArray(answers) ? followupReport(answers) : answers;
  }

  async resume(casesDir: string): Promise<EvalReport> {
    const cases = await loadResumeCases(casesDir);
    const answers = await this.answerAll(cases, (evalCase) =>
      this.resumeAnswer(casesDir, evalCase),
    );
    return Array.isArray(answers) ? resumeReport(answers) : answers;
  }

  private async answerAll<C extends { file: string }, A extends object>(
    cases: C[],
    answer: (evalCase: C) => Promise<A | Stopped>,
  ): Promise<A[] | EvalReport> {
    const answers: A[] = [];
    for (const evalCase of cases) {
      const outcome = await answer(evalCase);
      if (isStopped(outcome)) {
        return {
          lines: [`stopped\t${evalCase.file}\t${outcome.stoppedBy}`, 'FAIL'],
          passed: false,
        };
      }
      answers.push(outcome);
    }
    return answers;
  }

  private async vacancyAnswer({
    file,
    text,
    expected,
  }: VacancyEvalCase): Promise<VacancyCaseAnswer | Stopped> {
    try {
      const input = AI_PAYLOAD_BUILDERS.vacancy_parse({ rawText: text });
      const { output } = await this.ai.complete({ kind: 'vacancy_parse', input });
      return { file, expected, output: vacancyParseOutputSchema.parse(output) };
    } catch (error) {
      return { file, expected, ...refusalOf(error) };
    }
  }

  private async matchAnswer({
    file,
    rank,
    input,
  }: MatchEvalCase): Promise<MatchCaseAnswer | Stopped> {
    try {
      const { output } = await this.ai.complete({ kind: 'match', input });
      const breakdown = scoreMatch(matchOutputSchema.parse(output));
      return { file, manualRank: rank, score: breakdown?.score ?? null };
    } catch (error) {
      return { file, manualRank: rank, ...refusalOf(error) };
    }
  }

  private async followupAnswer({
    file,
    ...input
  }: FollowupEvalCase): Promise<FollowupCaseAnswer | Stopped> {
    try {
      const { output } = await this.ai.complete({ kind: 'followup', input });
      return { file, input, output: followupOutputSchema.parse(output) };
    } catch (error) {
      return { file, input, ...refusalOf(error) };
    }
  }

  private async resumeAnswer(
    casesDir: string,
    { file, document, expected }: ResumeEvalCase,
  ): Promise<ResumeCaseAnswer | Stopped> {
    const started = this.clock.now().getTime();
    const msSinceStart = () => this.clock.now().getTime() - started;
    try {
      const output = await this.profileOf(casesDir, document);
      return { file, expected, output, ms: msSinceStart() };
    } catch (error) {
      return { file, expected, ms: msSinceStart(), ...refusalOf(error) };
    }
  }

  private async profileOf(casesDir: string, document: string): Promise<ResumeParseOutput> {
    const bytes = new Uint8Array(await readFile(join(casesDir, document)));
    const mime = detectResumeFormat(bytes) ?? 'application/octet-stream';
    const extraction = await this.documents.extract({ bytes, filename: document, mime });
    const input = AI_PAYLOAD_BUILDERS.resume_parse(extraction);
    const { output } = await this.ai.complete({ kind: 'resume_parse', input });
    return resumeParseOutputSchema.parse(output);
  }
}
