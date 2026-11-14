import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { type Env, validateEnv } from '../config/env.js';
import { exampleEnv } from '../test/example-env.js';
import { costUsd, pricePerMillionOf } from './ai-cost.js';

const SONNET_PRICE = { tokensIn: 3, tokensOut: 15 };

describe('costUsd', () => {
  it('prices input and output tokens per million at their own rate', () => {
    expect(costUsd({ tokensIn: 400, tokensOut: 100 }, SONNET_PRICE)).toBeCloseTo(0.0027, 10);
  });

  it('costs nothing while both prices are 0', () => {
    expect(costUsd({ tokensIn: 400, tokensOut: 100 }, { tokensIn: 0, tokensOut: 0 })).toBe(0);
  });
});

describe('pricePerMillionOf', () => {
  it('reads the input and output price from the validated config', () => {
    const config = new ConfigService<Env, true>(
      validateEnv({
        ...exampleEnv,
        AI_USD_PER_MILLION_TOKENS_IN: '3',
        AI_USD_PER_MILLION_TOKENS_OUT: '15',
      }),
    );

    expect(pricePerMillionOf(config)).toEqual(SONNET_PRICE);
  });
});
