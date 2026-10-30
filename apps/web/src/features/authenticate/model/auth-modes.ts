import { loginInputSchema, registerInputSchema } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type AuthMode = 'login' | 'register';

export const CREDENTIAL_FIELDS = loginInputSchema.keyof().options;

export type CredentialField = (typeof CREDENTIAL_FIELDS)[number];

export type AuthModeCopy = {
  title: string;
  submit: string;
  fields: Readonly<Record<CredentialField, string>>;
};

export type AuthModeSpec = {
  href: '/login' | '/register';
  path: '/auth/login' | '/auth/register';
  schema: typeof loginInputSchema;
  copy: AuthModeCopy;
  password: { autoComplete: 'current-password' | 'new-password'; hint?: string };
};

const COPY = uk.auth;

export const AUTH_MODES: Readonly<Record<AuthMode, AuthModeSpec>> = {
  login: {
    href: '/login',
    path: '/auth/login',
    schema: loginInputSchema,
    copy: {
      ...COPY.login,
      fields: { email: COPY.email.invalid, password: COPY.password.missing },
    },
    password: { autoComplete: 'current-password' },
  },
  register: {
    href: '/register',
    path: '/auth/register',
    schema: registerInputSchema.pick({ email: true, password: true }),
    copy: {
      ...COPY.register,
      fields: { email: COPY.email.invalid, password: COPY.password.invalidNew },
    },
    password: { autoComplete: 'new-password', hint: COPY.password.hint },
  },
};

export function credentialFieldOf(path: readonly PropertyKey[] | undefined) {
  return CREDENTIAL_FIELDS.find((field) => field === path?.[0]);
}
