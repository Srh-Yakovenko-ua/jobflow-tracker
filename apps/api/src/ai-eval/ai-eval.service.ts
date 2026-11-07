import { vacancyParseOutputSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { AiClient, AiServiceError } from '../modules/ai/index.js';
import { loadVacancyCases, type VacancyEvalCase } from './vacancy-cases.js';
import { type VacancyCaseAnswer, type VacancyEvalReport, vacancyReport } from './vacancy-score.js';

const RUN_STOPPERS = new Set(['not_ready', 'ai_timeout']);

type CaseOutcome = VacancyCaseAnswer | { stoppedBy: string };

@Injectable()
export class AiEvalService {
  constructor(private readonly ai: AiClient) {}

  async vacancy(casesDir: string): Promise<VacancyEvalReport> {
    const answers: VacancyCaseAnswer[] = [];
    for (const evalCase of await loadVacancyCases(casesDir)) {
      const outcome = await this.answer(evalCase);
      if ('stoppedBy' in outcome) {
        return {
          lines: [`stopped\t${evalCase.file}\t${outcome.stoppedBy}`, 'FAIL'],
          passed: false,
        };
      }
      answers.push(outcome);
    }
    return vacancyReport(answers);
  }

  private async answer({ file, text, expected }: VacancyEvalCase): Promise<CaseOutcome> {
    try {
      const { output } = await this.ai.complete({ kind: 'vacancy_parse', input: { text } });
      return { file, expected, output: vacancyParseOutputSchema.parse(output) };
    } catch (error) {
      if (!(error instanceof AiServiceError)) {
        throw error;
      }
      return RUN_STOPPERS.has(error.type)
        ? { stoppedBy: error.type }
        : { file, expected, error: error.type };
    }
  }
}
