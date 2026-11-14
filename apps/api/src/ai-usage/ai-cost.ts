import type { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

export type TokenCounts = { tokensIn: number; tokensOut: number };

const TOKENS_PER_PRICE = 1_000_000;

export function pricePerMillionOf(config: ConfigService<Env, true>): TokenCounts {
  return {
    tokensIn: config.get('AI_USD_PER_MILLION_TOKENS_IN', { infer: true }),
    tokensOut: config.get('AI_USD_PER_MILLION_TOKENS_OUT', { infer: true }),
  };
}

export function costUsd(tokens: TokenCounts, pricePerMillion: TokenCounts): number {
  return (
    (tokens.tokensIn * pricePerMillion.tokensIn + tokens.tokensOut * pricePerMillion.tokensOut) /
    TOKENS_PER_PRICE
  );
}
