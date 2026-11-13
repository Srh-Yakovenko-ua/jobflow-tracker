import type { RateResult } from '../src/schemas/analytics-funnel.js';
import type {
  ResumeAbComparison,
  ResumeAbResponse,
  ResumeAbVersion,
} from '../src/schemas/analytics-resume-ab.js';
import { INSUFFICIENT_RATES } from './rates.js';

export type DesignResumeAbOptions = { versionIdOf?: (number: number) => string };

const DESIGN_CONVERSIONS = {
  v2: { status: 'ok', value: 0.4074, low: 0.2451, high: 0.5927, successes: 11, trials: 27 },
  v1: { status: 'ok', value: 0.2381, low: 0.1063, high: 0.4509, successes: 5, trials: 21 },
} as const satisfies Record<string, RateResult>;

const DESIGN_ROWS: Omit<ResumeAbVersion, 'resumeVersionId'>[] = [
  {
    number: 3,
    title: 'для дизайн-ролей',
    applications: 3,
    screenings: 1,
    conversion: INSUFFICIENT_RATES.twoMore,
  },
  {
    number: 2,
    title: 'акцент на продукті',
    applications: 27,
    screenings: 11,
    conversion: DESIGN_CONVERSIONS.v2,
  },
  {
    number: 1,
    title: 'хронологічне',
    applications: 21,
    screenings: 5,
    conversion: DESIGN_CONVERSIONS.v1,
  },
];

function designVersionIdOf(number: number): string {
  return `0b7c4f1e-3a52-4d8e-9f61-2c5a7e9b4d0${String(number)}`;
}

export function buildDesignResumeAbComparison(): ResumeAbComparison {
  return {
    challenger: 2,
    baseline: 1,
    difference: 0.1693,
    test: 'z_test',
    pValue: 0.217,
    probabilityBetter: 0.8836,
    verdict: { status: 'ok', winner: 2, message: 'Схоже, CV v2 працює краще' },
    switch: {
      at: '2026-12-02T09:00:00Z',
      before: DESIGN_CONVERSIONS.v1,
      after: DESIGN_CONVERSIONS.v2,
    },
  };
}

export function buildDesignResumeAb({
  versionIdOf = designVersionIdOf,
}: DesignResumeAbOptions = {}): ResumeAbResponse {
  return {
    versions: DESIGN_ROWS.map((row) => ({ resumeVersionId: versionIdOf(row.number), ...row })),
    comparison: buildDesignResumeAbComparison(),
  };
}
