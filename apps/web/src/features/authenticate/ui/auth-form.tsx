'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { LoginInput } from '@jobflow/shared';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { AUTH_ROUTES } from '@/shared/lib/return-to';
import { useCountdown } from '@/shared/lib/use-countdown';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PasswordInput } from '@/shared/ui/password-input';

import { type AuthAlert, authAlertOf } from '../lib/auth-alert';
import {
  AUTH_MODES,
  type AuthMode,
  type AuthModeSpec,
  credentialFieldOf,
} from '../model/auth-modes';
import { useAuthenticateMutation } from '../model/use-authenticate-mutation';
import { useExistingSession } from '../model/use-existing-session';
import { AuthTabs } from './auth-tabs';
import { OAuthLinks } from './oauth-links';
import { RateLimitAlert } from './rate-limit-alert';

export type AuthNotice = 'oauthDenied';

export type AuthFormProps = Readonly<{
  mode: AuthMode;
  notice?: AuthNotice | undefined;
  returnTo?: string | undefined;
}>;

type CredentialFieldsProps = Readonly<{ form: UseFormReturn<LoginInput>; spec: AuthModeSpec }>;

type AlertSlotProps = Readonly<{ alert: AuthAlert | undefined; secondsLeft: number }>;

const EMPTY_CREDENTIALS: LoginInput = { email: '', password: '' };

const COPY = uk.auth;

function CredentialFields({ form, spec }: CredentialFieldsProps) {
  const { errors } = useFormState({ control: form.control });
  return (
    <div className="flex flex-col gap-3.5">
      <Field label={COPY.email.label} footer={{ error: errors.email?.message }}>
        <Input
          type="email"
          autoComplete="email"
          placeholder={COPY.email.placeholder}
          {...form.register('email')}
        />
      </Field>
      <Field
        label={COPY.password.label}
        footer={{ hint: spec.password.hint, error: errors.password?.message }}
      >
        <PasswordInput autoComplete={spec.password.autoComplete} {...form.register('password')} />
      </Field>
    </div>
  );
}

function AlertSlot({ alert, secondsLeft }: AlertSlotProps) {
  if (alert === undefined) return null;
  if (alert.kind === 'rateLimited') {
    return <RateLimitAlert secondsLeft={alert.deadline === undefined ? undefined : secondsLeft} />;
  }
  return <Banner tone="error" content={COPY.alerts[alert.kind]} />;
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-line-soft" />
      <span className="eyebrow text-ink-3">{COPY.or}</span>
      <span aria-hidden className="h-px flex-1 bg-line-soft" />
    </div>
  );
}

export function AuthForm({ mode, notice, returnTo = AUTH_ROUTES.home }: AuthFormProps) {
  const spec = AUTH_MODES[mode];
  const form = useForm<LoginInput>({
    mode: 'onBlur',
    defaultValues: EMPTY_CREDENTIALS,
    resolver: zodResolver(spec.schema, {
      error: (issue) => {
        const field = credentialFieldOf(issue.path);
        return field && spec.copy.fields[field];
      },
    }),
  });
  const mutation = useAuthenticateMutation({ mode, setError: form.setError, returnTo });
  useExistingSession({ returnTo, enabled: mutation.isIdle });
  const alert = authAlertOf({ error: mutation.error, submittedAt: mutation.submittedAt });
  const secondsLeft = useCountdown(alert?.kind === 'rateLimited' ? alert.deadline : undefined);
  const submit = form.handleSubmit((credentials) => {
    mutation.mutate(credentials);
  });
  return (
    <div className="flex flex-col gap-5.5">
      <h1 className="sr-only">{spec.copy.title}</h1>
      <AuthTabs mode={mode} />
      {notice !== undefined && <Banner tone="info" content={COPY.alerts[notice]} />}
      <form
        method="post"
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-5.5"
      >
        <CredentialFields form={form} spec={spec} />
        <AlertSlot alert={alert} secondsLeft={secondsLeft} />
        <Button
          type="submit"
          size="lg"
          loading={mutation.isPending}
          disabled={secondsLeft > 0}
          className="h-[46px] w-full rounded-md text-[15px]"
        >
          {spec.copy.submit}
        </Button>
      </form>
      <OrDivider />
      <OAuthLinks />
      <p className="text-[12.5px] leading-[1.55] text-ink-3">{COPY.privacy}</p>
    </div>
  );
}
