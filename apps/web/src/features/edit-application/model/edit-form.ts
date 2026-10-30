import {
  type ApplicationResponse,
  isNonEmptyPatch,
  updateApplicationInputSchema,
  type WorkMode,
} from '@jobflow/shared';
import { z } from 'zod';

export type EditFormValues = {
  position: string;
  company: string;
  url: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  location: string;
  workMode: WorkMode | '';
  stack: string[];
};

export type EditField = keyof EditFormValues;

export type EditPatch = Partial<Record<EditField, unknown>>;

export type PatchOfInput = Readonly<{ application: ApplicationResponse; values: EditFormValues }>;

export const EDIT_FIELDS = [
  'position',
  'company',
  'url',
  'salaryMin',
  'salaryMax',
  'currency',
  'location',
  'workMode',
  'stack',
] as const satisfies readonly EditField[];

const SALARY_FIELDS: readonly EditField[] = ['salaryMin', 'salaryMax'];

type FieldValue = ApplicationResponse[EditField];

function amountText(amount: number | null): string {
  return amount === null ? '' : String(amount);
}

function textOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

function amountOrNull(text: string): number | null {
  const amount = textOrNull(text);
  return amount === null ? null : Number(amount);
}

function normalized(values: EditFormValues): Record<EditField, FieldValue> {
  return {
    position: textOrNull(values.position),
    company: textOrNull(values.company),
    url: textOrNull(values.url),
    salaryMin: amountOrNull(values.salaryMin),
    salaryMax: amountOrNull(values.salaryMax),
    currency: textOrNull(values.currency)?.toUpperCase() ?? null,
    location: textOrNull(values.location),
    workMode: values.workMode === '' ? null : values.workMode,
    stack: values.stack,
  };
}

function sameValue(saved: FieldValue, next: FieldValue): boolean {
  if (Array.isArray(saved) && Array.isArray(next)) {
    return saved.length === next.length && saved.every((item, index) => item === next[index]);
  }
  return Object.is(saved, next);
}

export function formValuesOf(application: ApplicationResponse): EditFormValues {
  return {
    position: application.position,
    company: application.company,
    url: application.url ?? '',
    salaryMin: amountText(application.salaryMin),
    salaryMax: amountText(application.salaryMax),
    currency: application.currency ?? '',
    location: application.location ?? '',
    workMode: application.workMode ?? '',
    stack: [...application.stack],
  };
}

export function patchOf({ application, values }: PatchOfInput): EditPatch {
  const next = normalized(values);
  const changed = EDIT_FIELDS.filter((field) => !sameValue(application[field], next[field]));
  const salaryChanged = changed.some((field) => SALARY_FIELDS.includes(field));
  const sent = salaryChanged ? [...new Set([...changed, ...SALARY_FIELDS])] : changed;
  return Object.fromEntries(sent.map((field) => [field, next[field]]));
}

export function editFormSchemaOf(application: ApplicationResponse) {
  return z
    .custom<EditFormValues>()
    .transform((values): unknown => {
      const patch = patchOf({ application, values });
      return isNonEmptyPatch(patch) ? patch : null;
    })
    .pipe(updateApplicationInputSchema.nullable());
}
