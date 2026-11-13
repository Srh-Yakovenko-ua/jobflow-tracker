import { describe, expect, it } from 'vitest';

import { rateLabelOf } from './rate-label';

describe('rateLabelOf', () => {
  it('a share measured on enough rejections reads as a whole percent', () => {
    expect(
      rateLabelOf({
        status: 'ok',
        value: 0.1764705882,
        low: 0.0619112664,
        high: 0.4102945857,
        successes: 3,
        trials: 17,
      }),
    ).toBe('18%');
  });

  it('a share under five samples shows no percent, only how many are missing', () => {
    expect(
      rateLabelOf({
        status: 'insufficient_data',
        have: 4,
        need: 1,
        message: 'Ще 1 відгук до першого висновку',
      }),
    ).toBe('мало даних · Ще 1 відгук до першого висновку');
  });
});
