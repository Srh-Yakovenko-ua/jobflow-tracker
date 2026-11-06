import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { AiUsageRepository, type AiUsageRow } from './ai-usage.repository.js';

type UsageTotals = Pick<AiUsageRow, 'calls' | 'tokensIn' | 'tokensOut'>;

const TOTAL_COLUMNS = ['calls', 'tokens_in', 'tokens_out', 'cost_usd'];

const USAGE_COLUMNS = ['day', 'kind', 'model', 'calls', 'tokens_in', 'tokens_out'];

const NO_USAGE: UsageTotals = { calls: 0, tokensIn: 0, tokensOut: 0 };

const TOKENS_PER_PRICE = 1_000_000;

const tsv = (cells: (string | number)[]) => cells.join('\t');

function addUp(rows: AiUsageRow[], keyOf: (row: AiUsageRow) => string): Map<string, UsageTotals> {
  const totals = new Map<string, UsageTotals>();
  for (const row of rows) {
    const sum = totals.get(keyOf(row)) ?? NO_USAGE;
    totals.set(keyOf(row), {
      calls: sum.calls + row.calls,
      tokensIn: sum.tokensIn + row.tokensIn,
      tokensOut: sum.tokensOut + row.tokensOut,
    });
  }
  return totals;
}

@Injectable()
export class AiUsageService {
  private readonly pricePerMillion: { tokensIn: number; tokensOut: number };

  constructor(
    private readonly repository: AiUsageRepository,
    config: ConfigService<Env, true>,
  ) {
    this.pricePerMillion = {
      tokensIn: config.get('AI_USD_PER_MILLION_TOKENS_IN', { infer: true }),
      tokensOut: config.get('AI_USD_PER_MILLION_TOKENS_OUT', { infer: true }),
    };
  }

  async report(): Promise<string[]> {
    const rows = await this.repository.dailyUsage();
    return [
      tsv([...USAGE_COLUMNS, 'avg_latency_ms', 'cost_usd']),
      ...rows.map(({ day, kind, model, avgLatencyMs, ...usage }) =>
        tsv([
          day,
          kind,
          model,
          usage.calls,
          usage.tokensIn,
          usage.tokensOut,
          avgLatencyMs,
          this.cost(usage),
        ]),
      ),
      '',
      ...this.totals(
        'day',
        addUp(rows, (row) => row.day),
      ),
      '',
      ...this.totals(
        'kind',
        addUp(rows, (row) => row.kind),
      ),
    ];
  }

  private totals(keyColumn: string, totals: Map<string, UsageTotals>): string[] {
    const sorted = [...totals].sort(([left], [right]) => (left < right ? -1 : 1));
    return [
      tsv([keyColumn, ...TOTAL_COLUMNS]),
      ...sorted.map(([key, sum]) =>
        tsv([key, sum.calls, sum.tokensIn, sum.tokensOut, this.cost(sum)]),
      ),
    ];
  }

  private cost({ tokensIn, tokensOut }: UsageTotals): string {
    const usd =
      (tokensIn * this.pricePerMillion.tokensIn + tokensOut * this.pricePerMillion.tokensOut) /
      TOKENS_PER_PRICE;
    return usd.toFixed(4);
  }
}
