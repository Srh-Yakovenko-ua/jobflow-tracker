import { applicationIdSchema, capturePasteInputSchema } from '@jobflow/shared';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AppError } from './app-error.js';
import { SchemaValidationPipe, toValidationError } from './validation.js';

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

describe('SchemaValidationPipe', () => {
  const pipe = new SchemaValidationPipe();

  const ID_PARAM: ArgumentMetadata = { type: 'param', data: 'id', schema: applicationIdSchema };

  async function refusal(value: unknown, metadata: ArgumentMetadata) {
    const error: unknown = await pipe.transform(value, metadata).catch((thrown: unknown) => thrown);
    return error instanceof AppError
      ? [error.body.status, error.body.errors?.map(({ path }) => path)]
      : error;
  }

  it('names the route parameter a bare value was read from', async () => {
    expect(await refusal('not-a-uuid', ID_PARAM)).toEqual([422, ['id']]);
  });

  it('keeps the field path of a body parsed whole', async () => {
    const body: ArgumentMetadata = { type: 'body', schema: capturePasteInputSchema };

    expect(await refusal({ text: ' ' }, body)).toEqual([422, ['text']]);
  });

  it('hands over the value the schema accepts', async () => {
    const id = '0198c2f4-7a10-7c3e-9b1d-2f6a4e8c0d11';

    expect(await pipe.transform(id, ID_PARAM)).toBe(id);
  });
});
