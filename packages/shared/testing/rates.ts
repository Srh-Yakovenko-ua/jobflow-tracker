import type { RateResult } from '../src/schemas/analytics-funnel.js';

export const INSUFFICIENT_RATES = {
  oneMore: {
    have: 4,
    message: 'Ще 1 відгук до першого висновку',
    need: 1,
    status: 'insufficient_data',
  },
  twoMore: {
    have: 3,
    message: 'Ще 2 відгуки до першого висновку',
    need: 2,
    status: 'insufficient_data',
  },
  threeMore: {
    have: 2,
    message: 'Ще 3 відгуки до першого висновку',
    need: 3,
    status: 'insufficient_data',
  },
  fourMore: {
    have: 1,
    message: 'Ще 4 відгуки до першого висновку',
    need: 4,
    status: 'insufficient_data',
  },
  fiveMore: {
    have: 0,
    message: 'Ще 5 відгуків до першого висновку',
    need: 5,
    status: 'insufficient_data',
  },
} as const satisfies Record<string, RateResult>;
