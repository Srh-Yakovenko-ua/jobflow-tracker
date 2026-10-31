'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ChangePasswordInput, changePasswordInputSchema } from '@jobflow/shared';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/field';
import { PasswordInput } from '@/shared/ui/password-input';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useChangePasswordMutation } from '../model/use-change-password-mutation';

type PasswordFieldsProps = Readonly<{ form: UseFormReturn<ChangePasswordInput> }>;

const COPY = uk.settings.password;

const EMPTY_PASSWORDS: ChangePasswordInput = { currentPassword: '', newPassword: '' };

const RULE_MESSAGES: Readonly<Record<keyof ChangePasswordInput, string>> = {
  currentPassword: uk.auth.password.missing,
  newPassword: uk.auth.password.invalidNew,
};

const resolver = zodResolver(changePasswordInputSchema, {
  error: (issue) =>
    issue.path?.[0] === 'currentPassword'
      ? RULE_MESSAGES.currentPassword
      : RULE_MESSAGES.newPassword,
});

function PasswordFields({ form }: PasswordFieldsProps) {
  const { errors } = useFormState({ control: form.control });
  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      <Field label={COPY.current} footer={{ error: errors.currentPassword?.message }}>
        <PasswordInput autoComplete="current-password" {...form.register('currentPassword')} />
      </Field>
      <Field
        label={COPY.next}
        footer={{ hint: uk.auth.password.hint, error: errors.newPassword?.message }}
      >
        <PasswordInput autoComplete="new-password" {...form.register('newPassword')} />
      </Field>
    </div>
  );
}

function FormFailure({ form }: PasswordFieldsProps) {
  const { errors } = useFormState({ control: form.control });
  if (errors.root?.server === undefined) return null;
  return <Banner tone="error" content={COPY.failed} />;
}

export function ChangePasswordForm() {
  const form = useForm<ChangePasswordInput>({
    mode: 'onBlur',
    defaultValues: EMPTY_PASSWORDS,
    resolver,
  });
  const mutation = useChangePasswordMutation(form);
  const submit = form.handleSubmit((passwords) => {
    mutation.mutate(passwords);
  });
  return (
    <form
      method="post"
      noValidate
      aria-label={COPY.title}
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex flex-col gap-4"
    >
      <PasswordFields form={form} />
      <FormFailure form={form} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="secondary"
          loading={mutation.isPending}
          className={TOUCH_HEIGHT}
        >
          {COPY.submit}
        </Button>
        <p role="status" className="text-[13px] leading-[1.45] text-ink-2">
          {mutation.isSuccess ? COPY.changed : null}
        </p>
      </div>
    </form>
  );
}
