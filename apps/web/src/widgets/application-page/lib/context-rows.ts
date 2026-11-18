import {
  type ApplicationResponse,
  countedUk,
  DAY_FORMS_UK,
  isActiveStage,
  type NormsResponse,
  SOURCE_LABELS,
  type Stage,
} from '@jobflow/shared';

import { daysInFunnelOf } from '@/entities/application';
import { uk } from '@/shared/i18n';

const COPY = uk.applicationPage.context;

export type ContextNorms = Readonly<{
  medianDaysToOffer: number | null;
  stageNormDays: number | null;
}>;

export const NO_NORMS: ContextNorms = { medianDaysToOffer: null, stageNormDays: null };

export type ContextNormsInput = Readonly<{ norms: NormsResponse | undefined; stage: Stage }>;

export function contextNormsOf({ norms, stage }: ContextNormsInput): ContextNorms | undefined {
  if (norms === undefined) return undefined;
  return {
    medianDaysToOffer: norms.medianDaysToOffer,
    stageNormDays: isActiveStage(stage) ? norms.stageNormDays[stage] : null,
  };
}

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
  norms: ContextNorms | undefined;
}>;

type NormValue = Readonly<{ value: string | null; hint: string | null }>;

function daysOf(days: number): string {
  return countedUk(days, DAY_FORMS_UK);
}

function hintOf(known: number | null): string | null {
  return known === null ? COPY.lowData : null;
}

function stageValueOf(daysInStage: number, stageNormDays: number | null): string {
  const days = daysOf(daysInStage);
  return stageNormDays === null ? days : `${days} ${uk.application.stageNorm(stageNormDays)}`;
}

function stageRowsOf({ application, norms }: ContextRowsInput): ContextRow[] {
  if (!isActiveStage(application.currentStage)) return [];
  const known = norms?.stageNormDays ?? null;
  const value = stageValueOf(application.daysInStage, known);
  const hint = norms === undefined ? null : hintOf(known);
  return [{ id: 'stage', label: COPY.inStage, value, hint }];
}

function medianOf(norms: ContextNorms | undefined): NormValue {
  if (norms === undefined) return { value: uk.analytics.noValue, hint: null };
  const median = norms.medianDaysToOffer;
  return { value: median === null ? null : daysOf(median), hint: hintOf(median) };
}

export function contextRowsOf(input: ContextRowsInput): ContextRow[] {
  const { application, now, timeZone, norms } = input;
  const appliedAt = application.appliedAt ?? application.createdAt;
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
    { id: 'median', label: COPY.medianToOffer, ...medianOf(norms) },
    ...stageRowsOf(input),
  ];
}
