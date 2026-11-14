import type { AiKind } from '@jobflow/shared';

import { costUsd, type TokenCounts } from '../ai-usage/ai-cost.js';

export type EvalCall = TokenCounts & { kind: AiKind; model: string; latencyMs: number };

type UsageGroup = TokenCounts & { kind: AiKind; model: string; calls: number; latencyMs: number };

const EVAL_USAGE = {
  columns: [
    'kind',
    'model',
    'calls',
    'tokens_in',
    'tokens_out',
    'avg_tokens_in',
    'avg_tokens_out',
    'avg_latency_ms',
    'cost_usd_per_call',
    'usd_per_million_tokens_in',
    'usd_per_million_tokens_out',
  ],
  costDigits: 6,
} as const;

function groupByKindAndModel(calls: EvalCall[]): UsageGroup[] {
  const groups = new Map<string, UsageGroup>();
  for (const { kind, model, tokensIn, tokensOut, latencyMs } of calls) {
    const key = `${kind}\t${model}`;
    const sum = groups.get(key) ?? {
      kind,
      model,
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
    };
    groups.set(key, {
      kind,
      model,
      calls: sum.calls + 1,
      tokensIn: sum.tokensIn + tokensIn,
      tokensOut: sum.tokensOut + tokensOut,
      latencyMs: sum.latencyMs + latencyMs,
    });
  }
  return [...groups.values()];
}

export function evalUsageLines(calls: EvalCall[], pricePerMillion: TokenCounts): string[] {
  const rows = groupByKindAndModel(calls).map((group) => {
    const perCall = (total: number) => Math.round(total / group.calls);
    const costPerCall = costUsd(group, pricePerMillion) / group.calls;
    return [
      group.kind,
      group.model,
      group.calls,
      group.tokensIn,
      group.tokensOut,
      perCall(group.tokensIn),
      perCall(group.tokensOut),
      perCall(group.latencyMs),
      costPerCall.toFixed(EVAL_USAGE.costDigits),
      pricePerMillion.tokensIn,
      pricePerMillion.tokensOut,
    ];
  });
  return [EVAL_USAGE.columns, ...rows].map((cells) => cells.join('\t'));
}
