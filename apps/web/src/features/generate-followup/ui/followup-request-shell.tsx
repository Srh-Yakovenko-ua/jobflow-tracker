'use client';

import {
  FOLLOWUP_LANGUAGES,
  FOLLOWUP_LIMITS,
  FOLLOWUP_TONES,
  type FollowupRequest,
  type FollowupRequestInput,
} from '@jobflow/shared';
import type { ReactNode } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field } from '@/shared/ui/field';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { Textarea } from '@/shared/ui/textarea';

export type FollowupMethods = UseFormReturn<FollowupRequestInput, unknown, FollowupRequest>;

export type FollowupRequestShellProps = Readonly<{
  methods: FollowupMethods;
  onSubmit: () => void;
  view: Readonly<{ lead: ReactNode; actions: ReactNode }>;
}>;

const COPY = uk.followup;

const TONE_OPTIONS = FOLLOWUP_TONES.map((value) => ({ value, label: COPY.tone.options[value] }));

const LANGUAGE_OPTIONS = FOLLOWUP_LANGUAGES.map((value) => ({
  value,
  label: COPY.language.options[value],
}));

const HINT_ERRORS = { hint: COPY.hintTooLong(FOLLOWUP_LIMITS.hintMaxLength) } as const;

export function FollowupRequestShell({ methods, onSubmit, view }: FollowupRequestShellProps) {
  const { control } = methods;
  const hintError = useFieldError({ control, name: 'hint', messages: HINT_ERRORS });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3.5"
    >
      {view.lead}
      <div className="flex flex-wrap gap-2">
        <Controller
          control={control}
          name="tone"
          render={({ field }) => (
            <SegmentedControl
              aria-label={COPY.tone.label}
              options={TONE_OPTIONS}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="language"
          render={({ field }) => (
            <SegmentedControl
              aria-label={COPY.language.label}
              options={LANGUAGE_OPTIONS}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
      </div>
      <Field label={COPY.hint.label} footer={{ hint: COPY.hint.note, error: hintError }}>
        <Textarea
          rows={2}
          maxLength={FOLLOWUP_LIMITS.hintMaxLength}
          placeholder={COPY.hint.placeholder}
          className="min-h-16"
          {...methods.register('hint')}
        />
      </Field>
      {view.actions}
    </form>
  );
}
