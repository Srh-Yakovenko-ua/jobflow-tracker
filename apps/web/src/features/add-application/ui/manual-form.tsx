'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CreateApplicationInput, createApplicationInputSchema } from '@jobflow/shared';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { SOURCE_OPTIONS } from '@/shared/ui/source-options';

import { useCreateApplication } from '../model/use-add-application';
import { AddFlow, type AddStep } from './add-flow';
import { AddForm } from './add-form';

type ManualValues = z.input<typeof createApplicationInputSchema>;

type ManualMethods = UseFormReturn<ManualValues, unknown, CreateApplicationInput>;

type TextFieldProps = Readonly<{
  methods: ManualMethods;
  name: 'company' | 'position';
  autoFocus?: boolean;
}>;

type ManualFieldsProps = Readonly<{ step: AddStep }>;

const COPY = uk.add.manual;

const FIELDS = ['company', 'position', 'source'] as const;

const DEFAULT_SOURCE = createApplicationInputSchema.shape.source.parse(undefined);

const BLANK: ManualValues = { company: '', position: '', source: DEFAULT_SOURCE };

const SOURCE_GROUPS = [{ options: SOURCE_OPTIONS }];

const resolver = zodResolver(createApplicationInputSchema);

function TextField({ methods, name, autoFocus = false }: TextFieldProps) {
  const error = useFieldError({ control: methods.control, name, messages: COPY.errors });
  return (
    <Field label={COPY.fields[name]} footer={{ error }}>
      <Input
        required
        autoFocus={autoFocus}
        placeholder={COPY.placeholders[name]}
        {...methods.register(name)}
      />
    </Field>
  );
}

function SourceField({ methods }: Pick<TextFieldProps, 'methods'>) {
  const error = useFieldError({
    control: methods.control,
    name: 'source',
    messages: COPY.errors,
  });
  return (
    <Field label={COPY.fields.source} footer={{ error }}>
      <Controller
        control={methods.control}
        name="source"
        render={({ field }) => (
          <Select
            groups={SOURCE_GROUPS}
            value={field.value ?? DEFAULT_SOURCE}
            onValueChange={field.onChange}
          />
        )}
      />
    </Field>
  );
}

function ManualFields({ step }: ManualFieldsProps) {
  const methods = useForm<ManualValues, unknown, CreateApplicationInput>({
    mode: 'onTouched',
    defaultValues: BLANK,
    resolver,
  });
  const mutation = useCreateApplication({
    form: { fields: FIELDS, setError: methods.setError, messages: COPY.errors },
    onAdded: step.onAdded,
  });
  return (
    <AddForm
      form={{ label: COPY.title, methods }}
      submit={{ label: COPY.submit, variant: 'outline', mutation }}
    >
      <TextField methods={methods} name="company" autoFocus={step.autoFocus} />
      <TextField methods={methods} name="position" />
      <SourceField methods={methods} />
    </AddForm>
  );
}

export function ManualForm() {
  return <AddFlow focusOnMount={false}>{(step) => <ManualFields step={step} />}</AddFlow>;
}
