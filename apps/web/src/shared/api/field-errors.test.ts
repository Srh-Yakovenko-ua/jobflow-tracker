import { type ErrorResponse, type RegisterInput, registerInputSchema } from '@jobflow/shared';
import type { UseFormSetError } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { errorBody } from '@/test/api-handlers';

import { ApiError } from './api-error';
import { applyFieldErrors } from './field-errors';

const REGISTER_FIELDS = registerInputSchema.keyof().options;

function applyToRegisterForm(body: ErrorResponse) {
  const setError = vi.fn<UseFormSetError<RegisterInput>>();
  const error = new ApiError({ body, retryAfterSeconds: undefined });
  applyFieldErrors<RegisterInput>({ error, fields: REGISTER_FIELDS, setError });
  return setError.mock.calls;
}

function validationFailed(errors: ErrorResponse['errors']): ErrorResponse {
  return errorBody({ status: 422, type: 'validation_failed', title: 'Validation failed', errors });
}

describe('applyFieldErrors', () => {
  it('puts each 422 entry on the form field its path names', () => {
    const calls = applyToRegisterForm(
      validationFailed([
        { path: 'email', message: 'Email is already registered' },
        { path: 'password', message: 'Too small: expected string to have >=10 characters' },
      ]),
    );

    expect(calls).toEqual([
      ['email', { type: 'server', message: 'Email is already registered' }],
      [
        'password',
        { type: 'server', message: 'Too small: expected string to have >=10 characters' },
      ],
    ]);
  });

  it('puts an entry whose path is not a form field on root.server', () => {
    const calls = applyToRegisterForm(
      validationFailed([
        { path: 'email', message: 'Invalid email address' },
        { path: 'inviteCode', message: 'Invite code expired' },
      ]),
    );

    expect(calls).toEqual([
      ['email', { type: 'server', message: 'Invalid email address' }],
      ['root.server', { type: 'server', message: 'Invite code expired' }],
    ]);
  });

  it('puts a 401 without errors on root.server with its detail', () => {
    const calls = applyToRegisterForm(
      errorBody({
        status: 401,
        type: 'invalid_credentials',
        title: 'Unauthorized',
        detail: 'Email or password is incorrect',
      }),
    );

    expect(calls).toEqual([
      ['root.server', { type: 'server', message: 'Email or password is incorrect' }],
    ]);
  });
});
