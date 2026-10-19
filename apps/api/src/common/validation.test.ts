import { describe, expect, it } from 'vitest';

import { toValidationError } from './validation.js';

describe('toValidationError', () => {
  it('turns schema issues into a 422 validation_error with one entry per field', () => {
    const error = toValidationError([
      { message: 'Too small', path: ['salaryMin'] },
      { message: 'Required', path: ['company'] },
    ]);

    expect(error.body).toEqual({
      type: 'validation_error',
      title: 'Invalid request',
      status: 422,
      errors: [
        { path: 'salaryMin', message: 'Too small' },
        { path: 'company', message: 'Required' },
      ],
    });
  });

  it('joins nested path segments with a dot, keys and indexes alike', () => {
    const error = toValidationError([
      { message: 'Expected string', path: [{ key: 'contacts' }, 0, { key: 'email' }] },
    ]);

    expect(error.body.errors).toEqual([{ path: 'contacts.0.email', message: 'Expected string' }]);
  });

  it('gives an issue on the whole value an empty path', () => {
    const error = toValidationError([{ message: 'Expected object' }]);

    expect(error.body.errors).toEqual([{ path: '', message: 'Expected object' }]);
  });
});
