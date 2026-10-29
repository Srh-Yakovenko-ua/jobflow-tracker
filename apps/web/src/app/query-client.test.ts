import { MutationObserver } from '@tanstack/react-query';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { applicationKeys } from '@/entities/application';
import { apiErrorOf } from '@/test/api-handlers';

import { createQueryClient } from './query-client';

const APPLICATION_ID = '01920000-0000-7000-8000-000000000001';

const UNAVAILABLE = apiErrorOf({ status: 503, type: 'service_unavailable' });

const FAILURES = [
  { failure: 'ApiError 503', error: UNAVAILABLE, calls: 2 },
  { failure: 'a network TypeError', error: new TypeError('Failed to fetch'), calls: 2 },
  {
    failure: 'a TimeoutError',
    error: new DOMException('Request timed out', 'TimeoutError'),
    calls: 2,
  },
  { failure: 'ApiError 404', error: apiErrorOf({ status: 404, type: 'not_found' }), calls: 1 },
  { failure: 'a ZodError', error: new ZodError([]), calls: 1 },
];

describe('createQueryClient', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it.each(FAILURES)(
    'a query that fails with $failure runs its queryFn $calls times',
    async ({ error, calls }) => {
      const queryFn = vi.fn().mockRejectedValue(error);

      const fetched = createQueryClient().query({
        queryKey: applicationKeys.detail(APPLICATION_ID),
        queryFn,
        retryDelay: 0,
      });

      await expect(fetched).rejects.toBe(error);
      expect(queryFn).toHaveBeenCalledTimes(calls);
    },
  );

  it('a failing mutation runs its mutationFn once', async () => {
    const mutationFn = vi.fn().mockRejectedValue(UNAVAILABLE);
    const observer = new MutationObserver(createQueryClient(), { mutationFn, retryDelay: 0 });

    await expect(observer.mutate(undefined)).rejects.toBe(UNAVAILABLE);
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });

  it('keeps a query fresh for 30 s and refetches on window focus only for the board', () => {
    const queryClient = createQueryClient();

    const board = queryClient.defaultQueryOptions({ queryKey: applicationKeys.board({}) });
    const detail = queryClient.defaultQueryOptions({
      queryKey: applicationKeys.detail(APPLICATION_ID),
    });

    expect(board).toMatchObject({ staleTime: 30_000, refetchOnWindowFocus: true });
    expect(detail).toMatchObject({ staleTime: 30_000, refetchOnWindowFocus: false });
  });
});
