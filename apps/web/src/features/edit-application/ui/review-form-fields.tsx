'use client';

import { type ApplicationResponse, type Source, sourceSchema } from '@jobflow/shared';
import { type ReactNode, useId } from 'react';

import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field, fieldLabelId, useField } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { SOURCE_OPTIONS } from '@/shared/ui/source-options';

import { NO_REVIEW, type ReviewedField, type ReviewFields } from '../lib/review-fields';
import { ConfidenceChip, REVIEW_NAMES } from './confidence-chip';
import {
  AMOUNT_INPUT,
  EDIT_ERRORS,
  EDIT_LABELS,
  type EditorForm,
  StackField,
  TextField,
} from './edit-fields';

export type SourcePick = Readonly<{ value: Source; onChange: (source: Source) => void }>;

export type ReviewFormFieldsProps = Readonly<{
  form: EditorForm;
  application: ApplicationResponse;
  reviews: ReviewFields | null;
  source: SourcePick;
}>;

type Reviews = Readonly<{ reviews: ReviewFields }>;

type ReviewedProps = Reviews & Readonly<{ field: ReviewedField; children: ReactNode }>;

type SalaryFieldProps = Pick<ReviewFormFieldsProps, 'form' | 'application'> & Reviews;

const COPY = uk.add.review;

const SOURCE_GROUPS = [{ options: SOURCE_OPTIONS }] as const;

function Reviewed({ field, reviews, children }: ReviewedProps) {
  return (
    <div data-confidence={reviews[field].confidence} className="min-w-0">
      {children}
    </div>
  );
}

function SalaryRange({ form }: Pick<ReviewFormFieldsProps, 'form'>) {
  const { id } = useField();
  const maxId = useId();
  const { register } = form.methods;
  return (
    <div
      role="group"
      aria-labelledby={id === undefined ? undefined : fieldLabelId(id)}
      className="grid grid-cols-2 gap-2"
    >
      <Input
        {...AMOUNT_INPUT}
        aria-label={EDIT_LABELS.salaryMin}
        className="tabular-nums"
        {...register('salaryMin')}
      />
      <Input
        {...AMOUNT_INPUT}
        id={maxId}
        aria-label={EDIT_LABELS.salaryMax}
        className="tabular-nums"
        {...register('salaryMax')}
      />
    </div>
  );
}

function SalaryField({ form, application, reviews }: SalaryFieldProps) {
  const { control } = form.methods;
  const minError = useFieldError({ control, name: 'salaryMin', messages: EDIT_ERRORS });
  const maxError = useFieldError({ control, name: 'salaryMax', messages: EDIT_ERRORS });
  return (
    <Field
      label={COPY.salary(application.currency)}
      aside={<ConfidenceChip field="salary" reviews={reviews} />}
      footer={{ error: minError ?? maxError }}
    >
      <SalaryRange form={form} />
    </Field>
  );
}

function SourceField({ source, reviews }: Pick<ReviewFormFieldsProps, 'source'> & Reviews) {
  return (
    <Field label={REVIEW_NAMES.source} aside={<ConfidenceChip field="source" reviews={reviews} />}>
      <Select
        groups={SOURCE_GROUPS}
        value={source.value}
        onValueChange={(value) => {
          const picked = sourceSchema.safeParse(value);
          if (picked.success) source.onChange(picked.data);
        }}
      />
    </Field>
  );
}

export function ReviewFormFields({
  form,
  application,
  reviews: parsed,
  source,
}: ReviewFormFieldsProps) {
  const reviews = parsed ?? NO_REVIEW;
  const chipOf = (field: ReviewedField) => <ConfidenceChip field={field} reviews={reviews} />;
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        <Reviewed field="company" reviews={reviews}>
          <TextField
            form={form}
            name="company"
            view={{ label: REVIEW_NAMES.company, aside: chipOf('company') }}
          />
        </Reviewed>
        <Reviewed field="position" reviews={reviews}>
          <TextField
            form={form}
            name="position"
            view={{ label: REVIEW_NAMES.position, aside: chipOf('position') }}
          />
        </Reviewed>
        <Reviewed field="salary" reviews={reviews}>
          <SalaryField form={form} application={application} reviews={reviews} />
        </Reviewed>
        <Reviewed field="source" reviews={reviews}>
          <SourceField source={source} reviews={reviews} />
        </Reviewed>
      </div>
      <Reviewed field="stack" reviews={reviews}>
        <StackField
          form={form}
          view={{
            label: parsed === null ? REVIEW_NAMES.stack : COPY.stack(application.stack.length),
            placeholder: COPY.addStack,
            aside: chipOf('stack'),
          }}
        />
      </Reviewed>
    </>
  );
}
