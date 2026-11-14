import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import { costUsd, pricePerMillionOf, type TokenCounts } from './ai-cost.js';
import { AiUsageRepository, type AiUsageRow } from './ai-usage.repository.js';

type UsageTotals = Pick<AiUsageRow, 'calls' | 'tokensIn' | 'tokensOut'>;

const AI_USAGE_REPORT = {
  usageColumns: ['day', 'kind', 'status', 'model', 'calls', 'tokens_in', 'tokens_out'],
  totalColumns: ['calls', 'tokens_in', 'tokens_out', 'cost_usd'],
  noUsage: { calls: 0, tokensIn: 0, tokensOut: 0 },
} as const;

const tsv = (cells: readonly (string | number)[]) => cells.join('\t');

function addUp(rows: AiUsageRow[], keyOf: (row: AiUsageRow) => string): Map<string, UsageTotals> {
  const totals = new Map<string, UsageTotals>();
  for (const row of rows) {
    const sum = totals.get(keyOf(row)) ?? AI_USAGE_REPORT.noUsage;
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
  private readonly pricePerMillion: TokenCounts;

  constructor(
    private readonly repository: AiUsageRepository,
    config: ConfigService<Env, true>,
  ) {
    this.pricePerMillion = pricePerMillionOf(config);
  }

  async report(): Promise<string[]> {
    const rows = await this.repository.dailyUsage();
    return [
      tsv([...AI_USAGE_REPORT.usageColumns, 'avg_latency_ms', 'cost_usd']),
      ...rows.map(({ day, kind, status, model, avgLatencyMs, ...usage }) =>
        tsv([
          day,
          kind,
          status,
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
      tsv([keyColumn, ...AI_USAGE_REPORT.totalColumns]),
      ...sorted.map(([key, sum]) =>
        tsv([key, sum.calls, sum.tokensIn, sum.tokensOut, this.cost(sum)]),
      ),
    ];
  }

  private cost(usage: UsageTotals): string {
    return costUsd(usage, this.pricePerMillion).toFixed(4);
  }
}
