import { describe, expect, it } from 'vitest';

import { NVIDIA_MODEL } from '../test/ai.js';
import { evalUsageLines } from './eval-usage.js';

const SONNET_PRICE = { tokensIn: 3, tokensOut: 15 };

const NVIDIA_VACANCY = { kind: 'vacancy_parse', model: NVIDIA_MODEL } as const;

const HEADER =
  'kind\tmodel\tcalls\ttokens_in\ttokens_out\tavg_tokens_in\tavg_tokens_out\tavg_latency_ms\tcost_usd_per_call\tusd_per_million_tokens_in\tusd_per_million_tokens_out';

describe('evalUsageLines', () => {
  it('sums the calls of each kind and model, averages them per call and prices one call', () => {
    const lines = evalUsageLines(
      [
        { ...NVIDIA_VACANCY, tokensIn: 101, tokensOut: 20, latencyMs: 700 },
        { ...NVIDIA_VACANCY, tokensIn: 302, tokensOut: 41, latencyMs: 901 },
        { kind: 'match', model: 'fake', tokensIn: 120, tokensOut: 40, latencyMs: 15 },
      ],
      SONNET_PRICE,
    );

    expect(lines).toEqual([
      HEADER,
      `vacancy_parse\t${NVIDIA_MODEL}\t2\t403\t61\t202\t31\t801\t0.001062\t3\t15`,
      'match\tfake\t1\t120\t40\t120\t40\t15\t0.000960\t3\t15',
    ]);
  });

  it('prints only the header when no call reached the provider', () => {
    expect(evalUsageLines([], SONNET_PRICE)).toEqual([HEADER]);
  });
});
