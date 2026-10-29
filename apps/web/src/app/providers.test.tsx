import { useMutation, useQuery } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { apiErrorOf } from '@/test/api-handlers';

import { Providers } from './providers';

const APPLICATION_ID = '01920000-0000-7000-8000-000000000001';

const SERVER_ERROR = apiErrorOf({ status: 500, type: 'internal_error' });

const SAVE_FAILED = uk.errors.saveFailed;

function renderInProviders<Result>(hook: () => Result) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Providers theme="light">{children}</Providers>
    ),
  });
}

function rejectWithServerError(): Promise<never> {
  return Promise.reject(SERVER_ERROR);
}

async function failSave(save: () => Promise<unknown>) {
  await act(async () => {
    await expect(save()).rejects.toBe(SERVER_ERROR);
  });
}

async function showSaveFailedToast() {
  const { result } = renderInProviders(() => useMutation({ mutationFn: rejectWithServerError }));
  await failSave(() => result.current.mutateAsync());
  return { saveAgain: () => failSave(() => result.current.mutateAsync()) };
}

describe('Providers', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it('a failed save shows one announced error toast, also after a second failure', async () => {
    const { saveAgain } = await showSaveFailedToast();
    await saveAgain();

    const title = await screen.findByText(SAVE_FAILED.title);
    expect(screen.getAllByText(SAVE_FAILED.description)).toHaveLength(1);
    expect(title.closest('[aria-live="polite"]')).not.toBeNull();
    expect(toast.getToasts()).toHaveLength(1);
  });

  it('keyboard focus reaches the close button and Enter dismisses the error toast', async () => {
    const user = userEvent.setup();
    await showSaveFailedToast();
    const close = await screen.findByRole('button', { name: uk.app.close });

    await user.keyboard('{Alt>}[KeyT]{/Alt}');
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByText(SAVE_FAILED.title)).toBeNull();
    });
  });

  it('a mutation that handles its own error shows no error toast', async () => {
    const { result } = renderInProviders(() =>
      useMutation({ mutationFn: rejectWithServerError, onError: () => undefined }),
    );

    await failSave(() => result.current.mutateAsync());

    expect(toast.getToasts()).toEqual([]);
  });

  it('a failed query keeps its error for the block after one call and shows no toast', async () => {
    const notFound = apiErrorOf({ status: 404, type: 'not_found' });
    const queryFn = vi.fn().mockRejectedValue(notFound);

    const { result } = renderInProviders(() =>
      useQuery({ queryKey: applicationKeys.detail(APPLICATION_ID), queryFn }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe(notFound);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(toast.getToasts()).toEqual([]);
  });
});
