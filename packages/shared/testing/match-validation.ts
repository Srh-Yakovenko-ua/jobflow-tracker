import {
  type MatchValidationResponse,
  matchValidationResponseSchema,
} from '../src/schemas/analytics-match-validation.js';

const DESIGN_MATCH_VALIDATION: MatchValidationResponse = {
  scored: 150,
  unscored: 6,
  buckets: [
    {
      bucket: 'below_50',
      applications: 51,
      screening: {
        status: 'ok',
        value: 0.4117647059,
        low: 0.29,
        high: 0.55,
        successes: 21,
        trials: 51,
      },
      interview: {
        status: 'ok',
        value: 0.137254902,
        low: 0.07,
        high: 0.26,
        successes: 7,
        trials: 51,
      },
    },
    {
      bucket: 'from_50_to_74',
      applications: 54,
      screening: {
        status: 'ok',
        value: 0.5740740741,
        low: 0.44,
        high: 0.7,
        successes: 31,
        trials: 54,
      },
      interview: {
        status: 'ok',
        value: 0.4074074074,
        low: 0.29,
        high: 0.54,
        successes: 22,
        trials: 54,
      },
    },
    {
      bucket: 'from_75',
      applications: 45,
      screening: {
        status: 'ok',
        value: 0.8666666667,
        low: 0.74,
        high: 0.94,
        successes: 39,
        trials: 45,
      },
      interview: {
        status: 'ok',
        value: 0.5111111111,
        low: 0.37,
        high: 0.65,
        successes: 23,
        trials: 45,
      },
    },
  ],
  statistics: {
    status: 'ok',
    applications: 150,
    correlation: 0.354,
    pValue: 0.0001,
    regression: { slope: 0.37, low: 0.2, high: 0.55 },
    significant: true,
    message: "Вакансії зі збігом 75+ доходять до інтерв'ю у 3,7 раза частіше, ніж до 50",
  },
};

export function buildDesignMatchValidation(): MatchValidationResponse {
  return matchValidationResponseSchema.parse(DESIGN_MATCH_VALIDATION);
}
