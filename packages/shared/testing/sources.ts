import { type SourcesResponse, sourcesResponseSchema } from '../src/schemas/analytics-sources.js';
import { INSUFFICIENT_RATES } from './rates.js';

const { fiveMore, fourMore, threeMore, twoMore } = INSUFFICIENT_RATES;

const DESIGN_SOURCES: SourcesResponse = {
  silentGhosts: { easyApply: 7, total: 14 },
  sources: [
    {
      applications: 24,
      conversion: {
        high: 0.6579146575,
        low: 0.2581978583,
        status: 'ok',
        successes: 9,
        trials: 20,
        value: 0.45,
      },
      easyApply: 0,
      ghostRate: {
        high: 0.3585307065,
        low: 0.0667867633,
        status: 'ok',
        successes: 4,
        trials: 24,
        value: 0.1666666667,
      },
      medianResponse: { days: 2, samples: 19, status: 'ok' },
      note: null,
      screenings: 9,
      source: 'djinni',
    },
    {
      applications: 6,
      conversion: {
        high: 0.7692757187,
        low: 0.1176207742,
        status: 'ok',
        successes: 2,
        trials: 5,
        value: 0.4,
      },
      easyApply: 0,
      ghostRate: {
        high: 0.7000066849,
        low: 0.0967714111,
        status: 'ok',
        successes: 2,
        trials: 6,
        value: 0.3333333333,
      },
      medianResponse: { days: 2, samples: 5, status: 'ok' },
      note: null,
      screenings: 2,
      source: 'dou',
    },
    {
      applications: 16,
      conversion: {
        high: 0.5474110309,
        low: 0.0632251071,
        status: 'ok',
        successes: 2,
        trials: 9,
        value: 0.2222222222,
      },
      easyApply: 7,
      ghostRate: {
        high: 0.7690134759,
        low: 0.331785564,
        status: 'ok',
        successes: 9,
        trials: 16,
        value: 0.5625,
      },
      medianResponse: { days: 2, samples: 5, status: 'ok' },
      note: null,
      screenings: 2,
      source: 'linkedin',
    },
    {
      applications: 3,
      conversion: twoMore,
      easyApply: 0,
      ghostRate: twoMore,
      medianResponse: twoMore,
      note: 'вибірка мала, але напрям однозначний',
      screenings: 3,
      source: 'referral',
    },
    {
      applications: 2,
      conversion: threeMore,
      easyApply: 0,
      ghostRate: threeMore,
      medianResponse: fourMore,
      note: null,
      screenings: 1,
      source: 'company_site',
    },
    {
      applications: 3,
      conversion: fourMore,
      easyApply: 0,
      ghostRate: twoMore,
      medianResponse: fiveMore,
      note: null,
      screenings: 0,
      source: 'robota',
    },
  ],
};

export function buildDesignSources(): SourcesResponse {
  return sourcesResponseSchema.parse(DESIGN_SOURCES);
}
