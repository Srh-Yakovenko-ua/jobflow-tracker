import {
  type ApplicationResponse,
  countedUk,
  DAY_FORMS_UK,
  isActiveStage,
  SOURCE_LABELS,
} from '@jobflow/shared';

import { daysInFunnelOf } from '@/entities/application';
import { uk } from '@/shared/i18n';

const COPY = uk.applicationPage.context;

export type ContextNorms = Readonly<{
  medianDaysToOffer: number | null;
  stageNormDays: number | null;
}>;

export const NO_NORMS: ContextNorms = { medianDaysToOffer: null, stageNormDays: null };

export type ContextRowId = 'source' | 'funnel' | 'median' | 'stage';

export type ContextRow = Readonly<{
  id: ContextRowId;
  label: string;
  value: string | null;
  hint: string | null;
}>;

export type ContextRowsInput = Readonly<{
  application: ApplicationResponse;
  now: Date;
  timeZone: string;
  norms: ContextNorms;
}>;

function daysOf(days: number): string {
  return countedUk(days, DAY_FORMS_UK);
}

function hintOf(known: number | null): string | null {
  return known === null ? COPY.lowData : null;
}

function stageValueOf({ application, norms }: ContextRowsInput): string {
  const days = daysOf(application.daysInStage);
  return norms.stageNormDays === null
    ? days
    : `${days} ${uk.application.stageNorm(norms.stageNormDays)}`;
}

function stageRowsOf(input: ContextRowsInput): ContextRow[] {
  if (!isActiveStage(input.application.currentStage)) return [];
  const hint = hintOf(input.norms.stageNormDays);
  return [{ id: 'stage', label: COPY.inStage, value: stageValueOf(input), hint }];
}

export function contextRowsOf(input: ContextRowsInput): ContextRow[] {
  const { application, now, timeZone, norms } = input;
  const appliedAt = application.appliedAt ?? application.createdAt;
  const median = norms.medianDaysToOffer;
  return [
    {
      id: 'source',
      label: COPY.source,
      value: SOURCE_LABELS[application.source].labelUk,
      hint: null,
    },
    {
      id: 'funnel',
      label: COPY.inFunnel,
      value: daysOf(daysInFunnelOf({ appliedAt, now, timeZone })),
      hint: null,
    },
    {
      id: 'median',
      label: COPY.medianToOffer,
      value: median === null ? null : daysOf(median),
      hint: hintOf(median),
    },
    ...stageRowsOf(input),
  ];
}
