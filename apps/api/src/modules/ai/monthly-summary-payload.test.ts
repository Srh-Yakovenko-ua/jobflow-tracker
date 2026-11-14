import {
  buildDesignFunnel,
  buildDesignReasons,
  buildDesignResumeAb,
  buildDesignSources,
  buildDesignWhatIfForecast,
  buildForecast,
  buildInsufficientForecast,
  buildMonthlySummaryInput,
  designInsightsBody,
} from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { privatePayloadPaths } from './ai-payload-guard.js';
import { monthlySummaryPayload, type MonthlySummarySource } from './monthly-summary-payload.js';

const DESIGN_SOURCE: MonthlySummarySource = {
  month: '2026-08',
  funnel: buildDesignFunnel(),
  forecast: buildForecast(),
  whatIf: { stage: 'tech_interview', forecast: buildDesignWhatIfForecast() },
  reasons: buildDesignReasons(),
  sources: buildDesignSources(),
  resumeAb: buildDesignResumeAb(),
  insights: designInsightsBody(),
  previousPlan: { items: 4, done: 3 },
};

describe('monthlySummaryPayload', () => {
  it('turns the design analytics bodies into exactly the design monthly summary input', () => {
    expect(monthlySummaryPayload(DESIGN_SOURCE)).toEqual(buildMonthlySummaryInput());
  });

  it('keeps an insufficient forecast as its status, have and need and gives no what-if', () => {
    const input = monthlySummaryPayload({
      ...DESIGN_SOURCE,
      forecast: buildInsufficientForecast(),
    });

    expect([input.forecast, input.whatIf]).toEqual([
      { status: 'insufficient_data', have: 9, need: 15 },
      null,
    ]);
  });

  it('carries no key the AI payload guard treats as private', () => {
    expect(privatePayloadPaths(monthlySummaryPayload(DESIGN_SOURCE))).toEqual([]);
  });

  it('gives no resume A/B block to a user without resume versions and no switch without a comparison', () => {
    const none = monthlySummaryPayload({
      ...DESIGN_SOURCE,
      resumeAb: { versions: [], comparison: null },
    });
    const noComparison = monthlySummaryPayload({
      ...DESIGN_SOURCE,
      resumeAb: { ...buildDesignResumeAb(), comparison: null },
    });

    expect([none.resumeAb, noComparison.resumeAb?.switch]).toEqual([null, null]);
  });
});
