'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ApplicationResponse, WORK_MODES } from '@jobflow/shared';
import { Controller, useForm } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { InlineEditorForm } from '@/shared/ui/inline-editor-form';
import type { ChoiceOption } from '@/shared/ui/radio-group';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import {
  type EditField,
  editFormSchemaOf,
  type EditFormValues,
  formValuesOf,
} from '../model/edit-form';
import { useUpdateApplicationMutation } from '../model/use-update-application-mutation';
import { AMOUNT_INPUT, EDIT_LABELS, type EditorForm, StackField, TextField } from './edit-fields';

export type ApplicationEditFormProps = Readonly<{
  application: ApplicationResponse;
  focusField: EditField;
  actions: { onDone: () => void };
}>;

type EditorPartProps = Readonly<{ form: EditorForm }>;

const COPY = uk.applicationPage.editor;

const WORK_MODE_OPTIONS: readonly ChoiceOption<EditFormValues['workMode']>[] = [
  { value: '', label: COPY.noWorkMode },
  ...WORK_MODES.map((mode) => ({ value: mode, label: uk.application.workModes[mode] })),
];

function WorkModeField({ form }: EditorPartProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden className="label w-fit text-ink">
        {EDIT_LABELS.workMode}
      </span>
      <Controller
        control={form.methods.control}
        name="workMode"
        render={({ field }) => (
          <SegmentedControl
            aria-label={EDIT_LABELS.workMode}
            options={WORK_MODE_OPTIONS}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
    </div>
  );
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
        <TextField form={form} name="salaryMin" input={AMOUNT_INPUT} />
        <TextField form={form} name="salaryMax" input={AMOUNT_INPUT} />
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
    mode: 'onTouched',
    defaultValues: formValuesOf(application),
    resolver: zodResolver(editFormSchemaOf(application)),
  });
  const mutation = useUpdateApplicationMutation({
    applicationId: application.id,
    setError: methods.setError,
    onSaved: actions.onDone,
  });
  const submit = methods.handleSubmit((patch) => {
    if (patch === null) actions.onDone();
    else mutation.save(patch);
  });
  return (
    <InlineEditorForm
      form={{ control: methods.control, onSubmit: submit, pending: mutation.isPending }}
      actions={{ onCancel: actions.onDone }}
      className="gap-4.5 rounded-xl bg-surface p-5 inset-ring inset-ring-line-soft"
    >
      <EditorFields form={{ methods, focusField }} />
    </InlineEditorForm>
  );
}
