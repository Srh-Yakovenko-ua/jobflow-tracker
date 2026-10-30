import type { LoginInput } from '@jobflow/shared';
import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { expect } from 'vitest';

import { AuthForm, type AuthFormProps, type AuthMode } from '@/features/authenticate';
import { apiClient, clearAccessToken } from '@/shared/api';
import { uk } from '@/shared/i18n';

import { freshSuggestionsRoute, SUGGESTIONS, SUGGESTIONS_REQUEST } from './api-handlers';
import { replace } from './navigation';
import { renderInApp } from './render-in-app';
import { server } from './server';
import { ME_RESPONSE } from './session-fixtures';

export type RenderedAuthForm = { user: UserEvent; mode: AuthMode };

export const CREDENTIALS: LoginInput = { email: ME_RESPONSE.user.email, password: 'jobflow-demo' };

export function authFormOf({ user, mode }: RenderedAuthForm) {
  const email = screen.getByRole('textbox', { name: uk.auth.email.label });
  const password = screen.getByLabelText(uk.auth.password.label);
  const submit = screen.getByRole('button', { name: uk.auth[mode].submit });
  async function fill(credentials: Partial<LoginInput>) {
    if (credentials.email !== undefined) await user.type(email, credentials.email);
    if (credentials.password !== undefined) await user.type(password, credentials.password);
  }
  async function fillAndSubmit(credentials: Partial<LoginInput>) {
    await fill(credentials);
    await user.click(submit);
  }
  return { user, email, password, submit, fill, fillAndSubmit };
}

export function renderAuthForm(props: AuthFormProps, beside?: ReactNode) {
  const user = renderInApp(
    <main>
      <AuthForm {...props} />
      {beside}
    </main>,
  );
  return authFormOf({ user, mode: props.mode });
}

export function resetSignIn() {
  clearAccessToken();
  replace.mockClear();
  toast.dismiss();
}

export async function expectSignedIn(landing = '/board') {
  await waitFor(() => {
    expect(replace).toHaveBeenCalledWith(landing);
  });
  server.use(freshSuggestionsRoute());
  await expect(apiClient.request(SUGGESTIONS_REQUEST)).resolves.toEqual(SUGGESTIONS);
}

export async function findAlertText() {
  return (await screen.findByRole('alert')).textContent;
}

export function invalidFields() {
  return Array.from(document.querySelectorAll('[aria-invalid="true"]'));
}
