import {
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AppError, conflict } from './app-error.js';
import { toAppError } from './to-app-error.js';

function bodyParserError(options: { status: number; expose: boolean; message: string }) {
  return Object.assign(new Error(options.message), {
    status: options.status,
    expose: options.expose,
  });
}

describe('toAppError', () => {
  it('passes an AppError through unchanged', () => {
    const error = conflict('Stage moved meanwhile');

    expect(toAppError(error)).toBe(error);
  });

  it('maps a Nest NotFoundException to 404 not_found with its message as detail', () => {
    expect(toAppError(new NotFoundException('Cannot GET /api/v1/nope')).body).toEqual({
      type: 'not_found',
      title: 'Not found',
      status: 404,
      detail: 'Cannot GET /api/v1/nope',
    });
  });

  it('maps a Nest PayloadTooLargeException to 413 payload_too_large', () => {
    expect(toAppError(new PayloadTooLargeException()).body).toMatchObject({
      type: 'payload_too_large',
      status: 413,
    });
  });

  it('maps a 4xx outside the status table to 400 bad_request', () => {
    expect(toAppError(new HttpException('Method not allowed', 405)).body).toMatchObject({
      type: 'bad_request',
      status: 400,
    });
  });

  it('maps an exposed body parser 400 to bad_request', () => {
    const error = bodyParserError({ status: 400, expose: true, message: 'Unexpected token' });

    expect(toAppError(error).body).toEqual({
      type: 'bad_request',
      title: 'Bad request',
      status: 400,
      detail: 'Unexpected token',
    });
  });

  it('maps an exposed body parser 413 to payload_too_large', () => {
    const error = bodyParserError({
      status: 413,
      expose: true,
      message: 'request entity too large',
    });

    expect(toAppError(error).body).toMatchObject({ type: 'payload_too_large', status: 413 });
  });

  it('hides an error that carries a status but is not exposed', () => {
    const error = bodyParserError({ status: 400, expose: false, message: 'socket detail' });

    expect(toAppError(error).body).toEqual({
      type: 'internal_error',
      title: 'Internal error',
      status: 500,
    });
  });

  it('answers a plain Error with 500 internal_error and no detail', () => {
    const body = toAppError(new Error('password authentication failed for user')).body;

    expect(body).toEqual({ type: 'internal_error', title: 'Internal error', status: 500 });
    expect(JSON.stringify(body)).not.toContain('password');
  });

  it('hides the message of a Nest 500 exception', () => {
    expect(toAppError(new InternalServerErrorException('pool exhausted')).body).toEqual({
      type: 'internal_error',
      title: 'Internal error',
      status: 500,
    });
  });

  it('answers a thrown non-Error value with 500', () => {
    expect(toAppError('boom')).toBeInstanceOf(AppError);
    expect(toAppError('boom').status).toBe(500);
  });

  it('never carries a stack in the body', () => {
    expect(Object.keys(toAppError(new Error('x')).body)).not.toContain('stack');
  });
});
