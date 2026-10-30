'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ApplicationResponse,
  STACK_MAX_ITEMS,
  type UpdateApplicationInput,
  WORK_MODES,
} from '@jobflow/shared';
import type { ComponentProps, KeyboardEvent } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import type { ChoiceOption } from '@/shared/ui/radio-group';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { OWNS_ESCAPE } from '@/shared/ui/sheet';
import { TagInput } from '@/shared/ui/tag-input';

import {
  type EditField,
  editFormSchemaOf,
  type EditFormValues,
  formValuesOf,
} from '../model/edit-form';
import { useUpdateApplicationMutation } from '../model/use-update-application-mutation';

export type ApplicationEditFormProps = Readonly<{
  application: ApplicationResponse;
  focusField: EditField;
  actions: { onDone: () => void };
}>;

type EditorForm = Readonly<{
  methods: UseFormReturn<EditFormValues, unknown, UpdateApplicationInput | null>;
  focusField: EditField;
}>;

type TextFieldName = Exclude<EditField, 'workMode' | 'stack'>;

type TextFieldProps = Readonly<{
  form: EditorForm;
  name: TextFieldName;
  input?: Pick<ComponentProps<'input'>, 'inputMode' | 'maxLength' | 'type'>;
}>;

type EditorPartProps = Readonly<{ form: EditorForm }>;

const COPY = uk.applicationPage.editor;

const LABELS: Readonly<Record<EditField, string>> = COPY.fields;

const ERRORS: Readonly<Record<EditField, string>> = {
  ...COPY.errors,
  stack: COPY.stackLimit(STACK_MAX_ITEMS),
};

const WORK_MODE_OPTIONS: readonly ChoiceOption<EditFormValues['workMode']>[] = [
  { value: '', label: COPY.noWorkMode },
  ...WORK_MODES.map((mode) => ({ value: mode, label: uk.application.workModes[mode] })),
];

const AMOUNT = { inputMode: 'numeric' } as const;

function useFieldError({ form, name }: Readonly<{ form: EditorForm; name: EditField }>) {
  const { errors } = useFormState({ control: form.methods.control, name });
  return errors[name] === undefined ? undefined : ERRORS[name];
}

function TextField({ form, name, input }: TextFieldProps) {
  const error = useFieldError({ form, name });
  return (
    <Field label={LABELS[name]} footer={{ error }}>
      <Input {...input} autoFocus={form.focusField === name} {...form.methods.register(name)} />
    </Field>
  );
}

function WorkModeField({ form }: EditorPartProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden className="label w-fit text-ink">
        {LABELS.workMode}
      </span>
      <Controller
        control={form.methods.control}
        name="workMode"
        render={({ field }) => (
          <SegmentedControl
            aria-label={LABELS.workMode}
            options={WORK_MODE_OPTIONS}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
    </div>
  );
}

function StackField({ form }: EditorPartProps) {
  const error = useFieldError({ form, name: 'stack' });
  return (
    <Field label={LABELS.stack} footer={{ error }}>
      <Controller
        control={form.methods.control}
        name="stack"
        render={({ field }) => (
          <TagInput
            value={field.value}
            onValueChange={field.onChange}
            placeholder={COPY.stackPlaceholder}
            autoFocus={form.focusField === 'stack'}
          />
        )}
      />
    </Field>
  );
}

function FormError({ form }: EditorPartProps) {
  const { errors } = useFormState({ control: form.methods.control });
  if (errors.root?.server === undefined) return null;
  return <Banner tone="error" content={COPY.invalid} />;
}

function EditorFields({ form }: EditorPartProps) {
  return (
    <div className="grid gap-3.5 @xl:grid-cols-2">
      <div className="@xl:col-span-2">
        <TextField form={form} name="position" />
      </div>
      <TextField form={form} name="company" />
      <TextField form={form} name="location" />
      <div className="grid grid-cols-[1fr_1fr_6rem] gap-3.5 @xl:col-span-2">
        <TextField form={form} name="salaryMin" input={AMOUNT} />
        <TextField form={form} name="salaryMax" input={AMOUNT} />
        <TextField form={form} name="currency" input={{ maxLength: 3 }} />
      </div>
      <div className="@xl:col-span-2">
        <WorkModeField form={form} />
      </div>
      <div className="@xl:col-span-2">
        <TextField form={form} name="url" input={{ type: 'url' }} />
      </div>
      <div className="@xl:col-span-2">
        <StackField form={form} />
      </div>
    </div>
  );
}

export function ApplicationEditForm({
  application,
  focusField,
  actions,
}: ApplicationEditFormProps) {
  const methods = useForm({
    mode: 'onBlur',
    defaultValues: formValuesOf(application),
    resolver: zodResolver(editFormSchemaOf(application)),
  });
  const mutation = useUpdateApplicationMutation({
    applicationId: application.id,
    setError: methods.setError,
  });
  const submit = methods.handleSubmit((patch) => {
    if (patch === null) actions.onDone();
    else mutation.mutate(patch, { onSuccess: actions.onDone });
  });
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    actions.onDone();
  };
  return (
    <form
      {...OWNS_ESCAPE}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4.5 rounded-xl bg-surface p-5 inset-ring inset-ring-line-soft"
    >
      <FormError form={{ methods, focusField }} />
      <EditorFields form={{ methods, focusField }} />
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" loading={mutation.isPending}>
          {COPY.save}
        </Button>
        <Button variant="outline" onClick={actions.onDone}>
          {COPY.cancel}
        </Button>
      </div>
    </form>
  );
}
