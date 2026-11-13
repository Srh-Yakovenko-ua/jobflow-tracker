import type { RateResult } from '../src/schemas/analytics-funnel.js';
import { type ReasonsResponse, reasonsResponseSchema } from '../src/schemas/analytics-reasons.js';
import { INSUFFICIENT_RATES } from './rates.js';

const THREE_OF_SEVENTEEN: RateResult = {
  high: 0.4102945857,
  low: 0.0619112664,
  status: 'ok',
  successes: 3,
  trials: 17,
  value: 0.1764705882,
};

const TWO_OF_SEVENTEEN: RateResult = {
  high: 0.3433635059,
  low: 0.0328797738,
  status: 'ok',
  successes: 2,
  trials: 17,
  value: 0.1176470588,
};

const ONE_OF_SEVENTEEN: RateResult = {
  high: 0.2698203064,
  low: 0.010460401,
  status: 'ok',
  successes: 1,
  trials: 17,
  value: 0.0588235294,
};

const ONE_OF_FIVE: RateResult = {
  high: 0.6244653702,
  low: 0.0362241086,
  status: 'ok',
  successes: 1,
  trials: 5,
  value: 0.2,
};

const { oneMore, threeMore } = INSUFFICIENT_RATES;

const DESIGN_REASONS: ReasonsResponse = {
  headline: { code: 'skills_gap', count: 3, of: 4, stage: 'tech_interview', status: 'ok' },
  stages: [
    {
      reasons: [
        { code: 'skills_gap', count: 3, share: THREE_OF_SEVENTEEN },
        { code: 'english_level', count: 3, share: THREE_OF_SEVENTEEN },
        { code: 'salary_expectations', count: 2, share: TWO_OF_SEVENTEEN },
        { code: 'chose_other', count: 2, share: TWO_OF_SEVENTEEN },
        { code: 'accepted_other', count: 2, share: TWO_OF_SEVENTEEN },
        { code: 'position_closed', count: 1, share: ONE_OF_SEVENTEEN },
        { code: 'no_explanation', count: 1, share: ONE_OF_SEVENTEEN },
        { code: 'low_salary', count: 1, share: ONE_OF_SEVENTEEN },
        { code: 'office_schedule', count: 1, share: ONE_OF_SEVENTEEN },
        { code: 'red_flags', count: 1, share: ONE_OF_SEVENTEEN },
      ],
      sides: {
        candidate: {
          count: 5,
          share: {
            high: 0.5313311007,
            low: 0.1327998961,
            status: 'ok',
            successes: 5,
            trials: 17,
            value: 0.2941176471,
          },
        },
        company: {
          count: 12,
          share: {
            high: 0.8672001039,
            low: 0.4686688993,
            status: 'ok',
            successes: 12,
            trials: 17,
            value: 0.7058823529,
          },
        },
      },
      stage: 'applied',
      stated: 17,
      top: null,
      total: 21,
      trend: null,
      unstated: [
        { code: 'silence_timeout', count: 2 },
        { code: 'unspecified', count: 2 },
      ],
    },
    {
      reasons: [
        { code: 'salary_expectations', count: 1, share: ONE_OF_FIVE },
        { code: 'chose_other', count: 1, share: ONE_OF_FIVE },
        { code: 'position_closed', count: 1, share: ONE_OF_FIVE },
        { code: 'no_explanation', count: 1, share: ONE_OF_FIVE },
        { code: 'low_salary', count: 1, share: ONE_OF_FIVE },
      ],
      sides: {
        candidate: { count: 1, share: ONE_OF_FIVE },
        company: {
          count: 4,
          share: {
            high: 0.9637758914,
            low: 0.3755346298,
            status: 'ok',
            successes: 4,
            trials: 5,
            value: 0.8,
          },
        },
      },
      stage: 'screening',
      stated: 5,
      top: null,
      total: 5,
      trend: null,
      unstated: [],
    },
    {
      reasons: [
        { code: 'skills_gap', count: 3, share: oneMore },
        { code: 'english_level', count: 1, share: oneMore },
      ],
      sides: {
        candidate: { count: 0, share: oneMore },
        company: { count: 4, share: oneMore },
      },
      stage: 'tech_interview',
      stated: 4,
      top: { code: 'skills_gap', count: 3, of: 4, stage: 'tech_interview', status: 'ok' },
      total: 4,
      trend: { changed: false, previous: 'skills_gap' },
      unstated: [],
    },
    {
      reasons: [
        { code: 'office_schedule', count: 1, share: threeMore },
        { code: 'red_flags', count: 1, share: threeMore },
      ],
      sides: {
        candidate: { count: 2, share: threeMore },
        company: { count: 0, share: threeMore },
      },
      stage: 'final',
      stated: 2,
      top: null,
      total: 2,
      trend: null,
      unstated: [],
    },
  ],
};

export function buildDesignReasons(): ReasonsResponse {
  return reasonsResponseSchema.parse(DESIGN_REASONS);
}
