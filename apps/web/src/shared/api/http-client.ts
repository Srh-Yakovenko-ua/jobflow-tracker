import type { z } from 'zod';

import { ApiError } from './api-error';
import { parseResponse } from './parse-response';
import { getAccessToken, refreshAfter } from './session';
import { send } from './transport';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type HttpClientOptions = {
  baseUrl: string;
  credentials: RequestCredentials;
};

export type HttpRequestOptions<T> = {
  path: string;
  schema: z.ZodType<T>;
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
};

export type HttpClient = {
  request<T>(options: HttpRequestOptions<T>): Promise<T>;
};

function isTokenExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.body.type === 'token_expired';
}

function headersFor(body: unknown, token: string | undefined): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
  };
}

export function createHttpClient({ baseUrl, credentials }: HttpClientOptions): HttpClient {
  function sendWith(options: HttpRequestOptions<unknown>, token: string | undefined) {
    const { path, method = 'GET', body, signal } = options;
    return send({
      url: `${baseUrl}${path}`,
      init: {
        method,
        credentials,
        headers: headersFor(body, token),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      signal,
    });
  }

  async function exchange(options: HttpRequestOptions<unknown>): Promise<unknown> {
    const sentToken = getAccessToken();
    try {
      return await sendWith(options, sentToken);
    } catch (error) {
      if (!isTokenExpired(error)) {
        throw error;
      }
      return sendWith(options, await refreshAfter(sentToken));
    }
  }

  return {
    async request<T>(options: HttpRequestOptions<T>): Promise<T> {
      const body = await exchange(options);
      const request = { method: options.method ?? 'GET', path: options.path };
      return parseResponse({ schema: options.schema, body, request });
    },
  };
}
