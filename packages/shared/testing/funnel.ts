import { type FunnelResponse, funnelResponseSchema } from '../src/schemas/analytics-funnel.js';

const DESIGN_FUNNEL: FunnelResponse = {
  kpis: {
    daysInSearch: 84,
    interviews: { previousMonth: 3, thisMonth: 5, total: 9 },
    offers: { previousMonth: 0, thisMonth: 1, total: 1 },
    sent: { previousMonth: 15, thisMonth: 19, total: 54 },
  },
  mostExpensive: {
    investedDaysMedian: 17.0,
    lost: 5,
    passed: 4,
    reached: 9,
    stage: 'tech_interview',
    status: 'ok',
  },
  stages: [
    {
      conversion: {
        high: 0.5780493146,
        low: 0.2850939256,
        status: 'ok',
        successes: 17,
        trials: 40,
        value: 0.425,
      },
      dropOff: { ghosted: 14, rejected: 21, withdrawn: 2 },
      passed: 17,
      reached: 54,
      stage: 'applied',
    },
    {
      conversion: {
        high: 0.8017550386,
        low: 0.3574683012,
        status: 'ok',
        successes: 9,
        trials: 15,
        value: 0.6,
      },
      dropOff: { ghosted: 2, rejected: 5, withdrawn: 1 },
      passed: 9,
      reached: 17,
      stage: 'screening',
    },
    {
      conversion: {
        high: 0.7847839378,
        low: 0.2152160622,
        status: 'ok',
        successes: 4,
        trials: 8,
        value: 0.5,
      },
      dropOff: { ghosted: 1, rejected: 4, withdrawn: 0 },
      passed: 4,
      reached: 9,
      stage: 'tech_interview',
    },
    {
      conversion: {
        have: 4,
        message: 'Ще 1 відгук до першого висновку',
        need: 1,
        status: 'insufficient_data',
      },
      dropOff: { ghosted: 0, rejected: 2, withdrawn: 1 },
      passed: 1,
      reached: 4,
      stage: 'final',
    },
    {
      conversion: null,
      dropOff: { ghosted: 0, rejected: 0, withdrawn: 0 },
      passed: null,
      reached: 1,
      stage: 'offer',
    },
  ],
};

export function buildDesignFunnel(): FunnelResponse {
  return funnelResponseSchema.parse(DESIGN_FUNNEL);
}
