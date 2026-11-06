import {
  type ApplicationFilters,
  applicationFiltersSchema,
  SOURCE_LABELS,
  type Stage,
  STAGE_LABELS,
  STAGES,
} from '@jobflow/shared';

import { formatAmount } from '@/entities/application';
import { withSearchParams } from '@/shared/api';
import { uk } from '@/shared/i18n';

const COPY = uk.board.filters.chips;

const FILTER_KEYS = applicationFiltersSchema.keyof().options;

export type BoardSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export type BoardFilterChip = Readonly<{ id: string; label: string; removal: ApplicationFilters }>;

type ListChips<Value> = {
  values: readonly Value[] | undefined;
  labelOf: (value: Value) => string;
  removalOf: (rest: Value[] | undefined) => ApplicationFilters;
};

export function boardFiltersOf(params: BoardSearchParams): ApplicationFilters {
  const readable = FILTER_KEYS.flatMap((key) => {
    const value = params[key];
    const valid =
      typeof value === 'string' && applicationFiltersSchema.shape[key].safeParse(value).success;
    return valid ? [[key, value]] : [];
  });
  return applicationFiltersSchema.parse(Object.fromEntries(readable));
}

export function toggledIn<Value>(values: readonly Value[] | undefined, value: Value) {
  const current = values ?? [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return next.length === 0 ? undefined : next;
}

function chipOf(label: string, removal: ApplicationFilters): BoardFilterChip {
  return { id: label, label, removal };
}

function listChips<Value>({ values = [], labelOf, removalOf }: ListChips<Value>) {
  return values.map((value) => chipOf(labelOf(value), removalOf(toggledIn(values, value))));
}

function scoreChips({ hasScore }: ApplicationFilters): BoardFilterChip[] {
  if (hasScore === undefined) {
    return [];
  }
  return [chipOf(hasScore ? COPY.hasScore.with : COPY.hasScore.without, { hasScore: undefined })];
}

function salaryChips({ salaryFrom }: ApplicationFilters): BoardFilterChip[] {
  return salaryFrom === undefined
    ? []
    : [chipOf(COPY.salaryFrom(formatAmount(salaryFrom)), { salaryFrom: undefined })];
}

export function chipsOf(filters: ApplicationFilters): BoardFilterChip[] {
  return [
    ...listChips({
      values: filters.source,
      labelOf: (source) => COPY.source(SOURCE_LABELS[source].labelUk),
      removalOf: (source) => ({ source }),
    }),
    ...listChips({
      values: filters.stage,
      labelOf: (stage) => COPY.stage(STAGE_LABELS[stage].labelUk),
      removalOf: (stage) => ({ stage }),
    }),
    ...scoreChips(filters),
    ...listChips({
      values: filters.silence,
      labelOf: (level) => COPY.silence[level],
      removalOf: (silence) => ({ silence }),
    }),
    ...salaryChips(filters),
  ];
}

export function shownStagesOf({ stage }: ApplicationFilters): Stage[] {
  return STAGES.filter((shown) => stage?.includes(shown) ?? true);
}

export function writeFiltersToUrl(filters: ApplicationFilters): void {
  window.history.replaceState(null, '', withSearchParams(window.location.pathname, filters));
}
