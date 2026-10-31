import type { MeResponse, UpdateUserSettingsInput } from '@jobflow/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { meQueryOptions, userKeys } from '@/entities/user';
import { errorReply } from '@/test/api-handlers';
import { latch } from '@/test/latch';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE } from '@/test/session-fixtures';
import { SETTINGS_URL, settingsRoutes, type SettingsRoutesOptions } from '@/test/settings-fixtures';

import { useUpdateSettingsMutation } from './use-update-settings-mutation';

const BOARD_KEY = applicationKeys.board({});

function renderSave(options: SettingsRoutesOptions = {}) {
  const routes = settingsRoutes(options);
  server.use(...routes.handlers);
  const { result } = renderHookInApp(() => ({
    settings: useUpdateSettingsMutation(),
    queryClient: useQueryClient(),
    me: useQuery(meQueryOptions()),
  }));
  act(() => {
    result.current.queryClient.setQueryData(userKeys.me(), ME_RESPONSE);
    result.current.queryClient.setQueryData(BOARD_KEY, { columns: {} });
  });
  const save = (patch: UpdateUserSettingsInput) => {
    act(() => {
      result.current.settings.save(patch);
    });
  };
  const cached = () => result.current.queryClient.getQueryData<MeResponse>(userKeys.me())?.settings;
  return { result, routes, save, cached };
}

afterEach(() => {
  toast.dismiss();
});

describe('useUpdateSettingsMutation', () => {
  it('shows the change at once, sends only that field and keeps it once the server agrees', async () => {
    const held = latch();
    const { result, routes, save, cached } = renderSave({ patch: { latch: held } });

    save({ silenceDays: 14 });

    await waitFor(() => {
      expect(routes.patches).toEqual([{ silenceDays: 14 }]);
    });
    expect(cached()?.silenceDays).toBe(14);
    expect(result.current.settings.status).toBe('pending');
    held.release();
    await waitFor(() => {
      expect(result.current.settings.status).toBe('success');
    });
    expect(cached()).toEqual({ ...ME_RESPONSE.settings, silenceDays: 14 });
  });

  it('sends a second change only after the first one has answered', async () => {
    const held = latch();
    const { routes, save } = renderSave({ patch: { latch: held } });

    save({ notifyInApp: true });
    save({ theme: 'dark' });

    await waitFor(() => {
      expect(routes.patches).toEqual([{ notifyInApp: true }]);
    });
    held.release();
    await waitFor(() => {
      expect(routes.patches).toEqual([{ notifyInApp: true }, { theme: 'dark' }]);
    });
  });

  it('a failed first change rolls back only its own field, keeps the later one and says so', async () => {
    const { result, save, cached } = renderSave();
    server.use(
      http.patch(SETTINGS_URL, () => errorReply({ status: 500, type: 'internal_error' }), {
        once: true,
      }),
    );

    save({ askRejectionReason: false });
    save({ monthlySummaryEnabled: true });

    expect(await screen.findByText('Не вдалося зберегти')).toBeDefined();
    await waitFor(() => {
      expect(result.current.settings.status).toBe('success');
    });
    expect(cached()?.askRejectionReason).toBe(true);
    expect(cached()?.monthlySummaryEnabled).toBe(true);
  });

  it('a quick second threshold stays on screen when the first one answers', async () => {
    const first = latch();
    const second = latch();
    const { result, routes, save, cached } = renderSave({ patch: { latch: second } });
    server.use(
      http.patch(
        SETTINGS_URL,
        async () => {
          await first.reached;
          return HttpResponse.json({ ...ME_RESPONSE.settings, silenceDays: 7 });
        },
        { once: true },
      ),
    );

    save({ silenceDays: 7 });
    save({ silenceDays: 14 });
    first.release();

    await waitFor(() => {
      expect(routes.patches).toEqual([{ silenceDays: 14 }]);
    });
    expect(cached()?.silenceDays).toBe(14);
    second.release();
    await waitFor(() => {
      expect(result.current.settings.status).toBe('success');
    });
    expect(cached()?.silenceDays).toBe(14);
  });

  it('two failed thresholds in a row keep the later one meanwhile and land on the stored one', async () => {
    const first = latch();
    const second = latch();
    const holds = [first, second];
    const { result, save, cached } = renderSave();
    server.use(
      http.patch(SETTINGS_URL, async () => {
        await holds.shift()?.reached;
        return errorReply({ status: 500, type: 'internal_error' });
      }),
    );

    save({ silenceDays: 7 });
    await waitFor(() => {
      expect(cached()?.silenceDays).toBe(7);
    });
    save({ silenceDays: 14 });
    await waitFor(() => {
      expect(cached()?.silenceDays).toBe(14);
    });
    first.release();
    expect(await screen.findByText('Не вдалося зберегти')).toBeDefined();
    expect(cached()?.silenceDays).toBe(14);
    second.release();
    await waitFor(() => {
      expect(result.current.settings.status).toBe('error');
    });
    await waitFor(() => {
      expect(cached()?.silenceDays).toBe(12);
    });
  });

  it.each([
    { patch: { silenceDays: 21 }, stale: true },
    { patch: { theme: 'dark' }, stale: false },
  ] as const)('after $patch the board is stale: $stale', async ({ patch, stale }) => {
    const { result, save } = renderSave();

    save(patch);

    await waitFor(() => {
      expect(result.current.settings.status).toBe('success');
    });
    expect(result.current.queryClient.getQueryState(BOARD_KEY)?.isInvalidated).toBe(stale);
  });
});
