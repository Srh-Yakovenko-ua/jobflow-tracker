'use client';

import { FOLLOWUP_LIMITS } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';

import { FollowupChoices, type FollowupMethods } from './followup-choices';

export type FollowupRequestShellProps = Readonly<{
  methods: FollowupMethods;
  onSubmit: () => void;
  view: Readonly<{ lead: ReactNode; actions: ReactNode }>;
}>;

const COPY = uk.followup;

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
      <FollowupChoices methods={methods} />
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
