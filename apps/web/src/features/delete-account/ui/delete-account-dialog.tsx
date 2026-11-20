'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type DeleteAccountInput, deleteAccountInputSchema } from '@jobflow/shared';
import { type ReactNode, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { ConfirmFooter } from '@/shared/ui/confirm-footer';
import { AlertDialogContent, Dialog, DialogTrigger } from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/field';
import { FormServerError } from '@/shared/ui/form-server-error';
import { PasswordInput } from '@/shared/ui/password-input';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useDeleteAccountMutation } from '../model/use-delete-account-mutation';

const COPY = uk.settings.account.deletion;

const EMPTY: DeleteAccountInput = { password: '' };

const resolver = zodResolver(deleteAccountInputSchema, { error: () => uk.auth.password.missing });

export type DeleteAccountDialogProps = Readonly<{ exportOffer: ReactNode }>;

function PasswordField({ form }: Readonly<{ form: UseFormReturn<DeleteAccountInput> }>) {
  const { errors } = useFormState({ control: form.control, name: 'password' });
  return (
    <Field
      label={COPY.dialog.password}
      footer={{ hint: COPY.dialog.passwordHint, error: errors.password?.message }}
    >
      <PasswordInput autoComplete="current-password" {...form.register('password')} />
    </Field>
  );
}

function DeleteAccountForm() {
  const form = useForm<DeleteAccountInput>({ mode: 'onTouched', defaultValues: EMPTY, resolver });
  const mutation = useDeleteAccountMutation(form.setError);
  const submit = form.handleSubmit(mutation.save);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex flex-col gap-4.5"
    >
      <FormServerError control={form.control} />
      <PasswordField form={form} />
      <ConfirmFooter
        copy={COPY.dialog}
        action={{
          pending: mutation.isPending,
          onConfirm: () => {
            void submit();
          },
        }}
      />
    </form>
  );
}

export function DeleteAccountDialog({ exportOffer }: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" className={TOUCH_HEIGHT}>
          {COPY.action}
        </Button>
      </DialogTrigger>
      <AlertDialogContent header={{ title: COPY.dialog.title, description: COPY.dialog.body }}>
        <section
          aria-label={COPY.dialog.exportOffer}
          className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4"
        >
          <p className="text-[13.5px] leading-[1.45] font-semibold text-ink">
            {COPY.dialog.exportOffer}
          </p>
          {exportOffer}
        </section>
        <DeleteAccountForm />
      </AlertDialogContent>
    </Dialog>
  );
}
