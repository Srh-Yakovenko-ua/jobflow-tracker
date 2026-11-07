import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { validateEnv } from '../config/env.js';
import { AI_USAGE_ROWS } from '../test/ai.js';
import { exampleEnv } from '../test/example-env.js';
import { AiUsageRepository } from './ai-usage.repository.js';
import { AiUsageService } from './ai-usage.service.js';

const SONNET_PRICES = { AI_USD_PER_MILLION_TOKENS_IN: '3', AI_USD_PER_MILLION_TOKENS_OUT: '15' };

const fakeRepository = {
  dailyUsage: () => Promise.resolve(AI_USAGE_ROWS),
} satisfies Pick<AiUsageRepository, 'dailyUsage'>;

async function reportAt(prices: Record<string, string>): Promise<string[]> {
  const config = new ConfigService(validateEnv({ ...exampleEnv, ...prices }));
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiUsageService,
      { provide: AiUsageRepository, useValue: fakeRepository },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  return moduleRef.get(AiUsageService).report();
}

describe('AiUsageService.report', () => {
  it('prints one line per UTC day, kind, status and model with its cost, failed calls on their own line, then the totals per day and per kind over every line', async () => {
    await expect(reportAt(SONNET_PRICES)).resolves.toEqual([
      'day\tkind\tstatus\tmodel\tcalls\ttokens_in\ttokens_out\tavg_latency_ms\tcost_usd',
      '2026-11-04\tvacancy_parse\tsucceeded\tfake\t2\t400\t100\t1500\t0.0027',
      '2026-11-04\tvacancy_parse\tfailed\t\t1\t0\t0\t0\t0.0000',
      '2026-11-05\tmatch\tsucceeded\tfake\t1\t50\t10\t500\t0.0003',
      '2026-11-05\tvacancy_parse\tsucceeded\tmeta/llama-3.3-70b-instruct\t1\t20\t5\t701\t0.0001',
      '',
      'day\tcalls\ttokens_in\ttokens_out\tcost_usd',
      '2026-11-04\t3\t400\t100\t0.0027',
      '2026-11-05\t2\t70\t15\t0.0004',
      '',
      'kind\tcalls\ttokens_in\ttokens_out\tcost_usd',
      'match\t1\t50\t10\t0.0003',
      'vacancy_parse\t4\t420\t105\t0.0028',
    ]);
  });

  it('prints a cost of 0.0000 on every line while both prices are left at 0', async () => {
    const lines = await reportAt({});

    expect(lines.map((line) => line.split('\t').at(-1))).toEqual([
      'cost_usd',
      '0.0000',
      '0.0000',
      '0.0000',
      '0.0000',
      '',
      'cost_usd',
      '0.0000',
      '0.0000',
      '',
      'cost_usd',
      '0.0000',
      '0.0000',
    ]);
  });
});
