import type { RateResult } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { percentOf } from './kpi-values';

const COPY = uk.analytics;

export function rateLabelOf(rate: RateResult): string {
  return rate.status === 'ok' ? COPY.percent(percentOf(rate.value)) : COPY.lowData(rate.message);
}
