import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type AiCompletion,
  type AiKind,
  cvHintsOutputSchema,
  followupOutputSchema,
  interviewPrepOutputSchema,
  matchOutputSchema,
  type ResumeParseOutput,
  resumeParseOutputSchema,
  vacancyParseOutputSchema,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import { pricePerMillionOf, type TokenCounts } from '../ai-usage/ai-cost.js';
import { Clock } from '../common/clock.js';
import type { Env } from '../config/env.js';
import {
  AI_PAYLOAD_BUILDERS,
  AiClient,
  type AiCompleteCall,
  AiServiceError,
  isFinal,
} from '../modules/ai/index.js';
import { scoreMatch } from '../modules/match/index.js';
import { detectResumeFormat, DocumentsClient } from '../modules/resumes/index.js';
import { DEFAULT_JOB_OPTIONS } from '../queues/queues.js';
import { loadCvHintsCases } from './cv-hints-cases.js';
import { cvHintsReport } from './cv-hints-report.js';
import type { EvalReport } from './eval-cases.js';
import { isStopped, refusalOf, type Stopped } from './eval-refusal.js';
import { type EvalCall, evalUsageLines } from './eval-usage.js';
import { loadFollowupCases } from './followup-cases.js';
import { followupReport } from './followup-report.js';
import { loadInterviewPrepCases } from './interview-prep-cases.js';
import { interviewPrepReport } from './interview-prep-report.js';
import { loadMatchCases, type MatchEvalCase } from './match-cases.js';
import { type MatchCaseAnswer, matchReport } from './match-report.js';
import { loadResumeCases, type ResumeEvalCase } from './resume-cases.js';
import { type ResumeCaseAnswer, resumeReport } from './resume-score.js';
import { loadVacancyCases, type VacancyEvalCase } from './vacancy-cases.js';
import { type VacancyCaseAnswer, vacancyReport } from './vacancy-score.js';

type CheckedKind<O> = { kind: AiKind; schema: z.ZodType<O> };

type Checked<C, O> = (C & { output: O }) | (C & { error: string });

@Injectable()
export class AiEvalService {
  private readonly calls: EvalCall[] = [];

  private readonly pricePerMillion: TokenCounts;

  constructor(
    private readonly ai: AiClient,
    private readonly documents: DocumentsClient,
    private readonly clock: Clock,
    config: ConfigService<Env, true>,
  ) {
    this.pricePerMillion = pricePerMillionOf(config);
  }

  usageLines(): string[] {
    return evalUsageLines(this.calls, this.pricePerMillion);
  }

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
    const drafts = await loadFollowupCases(casesDir);
    const cases = drafts.map(({ file, ...input }) => ({ file, input }));
    const answers = await this.answerAll(cases, (evalCase) =>
      this.checkedAnswer(evalCase, { kind: 'followup', schema: followupOutputSchema }),
    );
    return Array.isArray(answers) ? followupReport(answers) : answers;
  }

  async cvHints(casesDir: string): Promise<EvalReport> {
    const cases = await loadCvHintsCases(casesDir);
    const answers = await this.answerAll(cases, (evalCase) =>
      this.checkedAnswer(evalCase, { kind: 'cv_hints', schema: cvHintsOutputSchema }),
    );
    return Array.isArray(answers) ? cvHintsReport(answers) : answers;
  }

  async interviewPrep(casesDir: string): Promise<EvalReport> {
    const cases = await loadInterviewPrepCases(casesDir);
    const answers = await this.answerAll(cases, (evalCase) =>
      this.checkedAnswer(evalCase, { kind: 'interview_prep', schema: interviewPrepOutputSchema }),
    );
    return Array.isArray(answers) ? interviewPrepReport(answers) : answers;
  }

  async resume(casesDir: string): Promise<EvalReport> {
    const cases = await loadResumeCases(casesDir);
    const answers = await this.answerAll(cases, (evalCase) =>
      this.resumeAnswer(casesDir, evalCase),
    );
    return Array.isArray(answers) ? resumeReport(answers) : answers;
  }

  private async complete(
    call: AiCompleteCall,
    attemptsLeft: number = DEFAULT_JOB_OPTIONS.attempts,
  ): Promise<AiCompletion<AiKind>> {
    try {
      return await this.completeOnce(call);
    } catch (error) {
      const retried = error instanceof AiServiceError && !isFinal({ error, kind: call.kind });
      if (!retried || attemptsLeft <= 1) {
        throw error;
      }
      return this.complete(call, attemptsLeft - 1);
    }
  }

  private async completeOnce(call: AiCompleteCall) {
    const completion = await this.ai.complete(call);
    const { model, tokensIn, tokensOut, latencyMs } = completion;
    this.calls.push({ kind: call.kind, model, tokensIn, tokensOut, latencyMs });
    return completion;
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
      const { output } = await this.complete({ kind: 'vacancy_parse', input });
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
      const { output } = await this.complete({ kind: 'match', input });
      const breakdown = scoreMatch(matchOutputSchema.parse(output));
      return { file, manualRank: rank, score: breakdown?.score ?? null };
    } catch (error) {
      return { file, manualRank: rank, ...refusalOf(error) };
    }
  }

  private async checkedAnswer<C extends { input: unknown }, O>(
    evalCase: C,
    { kind, schema }: CheckedKind<O>,
  ): Promise<Checked<C, O> | Stopped> {
    try {
      const { output } = await this.complete({ kind, input: evalCase.input });
      return { ...evalCase, output: schema.parse(output) };
    } catch (error) {
      return { ...evalCase, ...refusalOf(error) };
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
    const { output } = await this.complete({ kind: 'resume_parse', input });
    return resumeParseOutputSchema.parse(output);
  }
}
