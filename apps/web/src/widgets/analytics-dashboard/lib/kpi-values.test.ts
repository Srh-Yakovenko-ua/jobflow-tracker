import { type FunnelResponse, insufficientDataSchema, type TimingsResponse } from '@jobflow/shared';
import { buildDesignFunnel, buildDesignTimings } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { ghostKpi, responseKpi, screeningKpi } from './kpi-values';

const SILENCE_DAYS = 14;

const timings = buildDesignTimings();

const tooFew = insufficientDataSchema.parse(timings.medianDaysToOffer);

function funnelWithoutScreeningSample(): FunnelResponse {
  const funnel = buildDesignFunnel();
  return {
    ...funnel,
    stages: funnel.stages.map((stage) =>
      stage.stage === 'applied' ? { ...stage, conversion: tooFew } : stage,
    ),
  };
}

function timingsWithoutSample(): TimingsResponse {
  return {
    ...timings,
    responseTime: tooFew,
    ghostRate: { ...timings.ghostRate, rate: tooFew, gap: null },
  };
}

describe('KPI tiles on a sample big enough', () => {
  it('screening shows the applied conversion with ghosted left out', () => {
    expect(screeningKpi(buildDesignFunnel())).toMatchObject({ value: '43%', caption: '17 із 40' });
  });

  it('response shows the median in whole days against the silence threshold', () => {
    expect(responseKpi({ timings, silenceDays: SILENCE_DAYS })).toMatchObject({
      value: '6',
      unit: 'днів',
      caption: 'поріг тиші: 14 днів',
    });
  });

  it('ghost rate shows the share, the gap to the market and the market range', () => {
    expect(ghostKpi(timings)).toMatchObject({
      value: '31%',
      caption: 'ринок: 18–22%',
      chip: { text: '+9 п.п.', tone: 'neutral' },
    });
  });
});

describe('KPI tiles below the sample threshold', () => {
  it('screening says there is too little data and how many are missing', () => {
    expect(screeningKpi(funnelWithoutScreeningSample())).toEqual({
      value: '—',
      caption: 'мало даних · Ще 4 відгуки до першого висновку',
    });
  });

  it('response says there is too little data and how many are missing', () => {
    expect(responseKpi({ timings: timingsWithoutSample(), silenceDays: SILENCE_DAYS })).toEqual({
      value: '—',
      caption: 'мало даних · Ще 4 відгуки до першого висновку',
    });
  });

  it('ghost rate says how many are missing and keeps the market range', () => {
    expect(ghostKpi(timingsWithoutSample())).toEqual({
      value: '—',
      caption: 'мало даних · Ще 4 відгуки до першого висновку · ринок: 18–22%',
    });
  });
});
