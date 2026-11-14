import { randomUUID } from 'node:crypto';

import { authResponseSchema, type LoginInput } from '@jobflow/shared';
import { type APIRequestContext, expect, type Page, test as base } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { apiUrl } from './stack';

export type E2eUser = LoginInput;

const AUTH = uk.auth;

function newUser(): E2eUser {
  return { email: `e2e-${randomUUID()}@example.com`, password: randomUUID() };
}

type AuthFormInput = { user: E2eUser; submit: string };

async function submitAuthForm(page: Page, { user, submit }: AuthFormInput): Promise<void> {
  const form = page.locator('form');
  await form.getByLabel(AUTH.email.label, { exact: true }).fill(user.email);
  await form.getByLabel(AUTH.password.label, { exact: true }).fill(user.password);
  await form.getByRole('button', { name: submit }).click();
  await page.waitForURL('**/board');
}

async function register(page: Page): Promise<E2eUser> {
  const user = newUser();
  await page.goto('/register');
  await submitAuthForm(page, { user, submit: AUTH.register.submit });
  return user;
}

export async function signIn(page: Page, user: E2eUser): Promise<void> {
  await page.goto('/login');
  await submitAuthForm(page, { user, submit: AUTH.login.submit });
}

export async function loginToken(request: APIRequestContext, user: E2eUser): Promise<string> {
  const response = await request.post(apiUrl('/auth/login'), { data: user });
  expect(response.ok()).toBe(true);
  return authResponseSchema.parse(await response.json()).accessToken;
}

export const test = base.extend<{ user: E2eUser }>({
  user: [
    async ({ page }, provide) => {
      await provide(await register(page));
    },
    { auto: true },
  ],
});

export { expect, base as signedOutTest };
