import { screen } from '@testing-library/react';
import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EXPORT_LINK, exportRoutes, type ExportRoutesOptions } from '@/test/account-fixtures';
import { advanceBy } from '@/test/advance-timers';
import { ANY_IDEMPOTENCY_KEY, apiUrl, errorReply } from '@/test/api-handlers';
import { fixtureIdOf } from '@/test/board-fixtures';
import { advancePastQueryRetries, fakeTimeoutsAndIntervals } from '@/test/fake-timeouts';
import { EXPORT_ID } from '@/test/notification-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { ExportDataControl } from './export-data-control';

const POLL_MS = 2_000;

const NEXT_EXPORT_ID = fixtureIdOf(82);

const DOWNLOAD = { name: 'Завантажити архів' } as const;

function renderControl({
  exportId = null,
  routes = {},
}: { exportId?: string | null; routes?: ExportRoutesOptions } = {}) {
  fakeTimeoutsAndIntervals();
  const { handlers, sent } = exportRoutes(routes);
  server.use(...handlers);
  const user = renderInApp(<ExportDataControl initialExportId={exportId} />);
  return { user, sent };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ExportDataControl', () => {
  it('asks for a csv archive once, says it is building and offers the signed link once the archive exists', async () => {
    const { user, sent } = renderControl();

    await user.click(screen.getByRole('radio', { name: 'CSV' }));
    await user.click(screen.getByRole('button', { name: 'Вивантажити' }));

    expect(await screen.findByText('Збираю архів…')).toBeDefined();
    expect(sent.requests).toEqual([
      { body: { format: 'csv' }, idempotencyKey: ANY_IDEMPOTENCY_KEY },
    ]);
    expect(screen.queryByRole('link', DOWNLOAD)).toBeNull();

    await advanceBy(POLL_MS);

    const download = await screen.findByRole('link', DOWNLOAD);
    expect(download.getAttribute('href')).toBe(EXPORT_LINK.url);
    expect(sent.links).toEqual([EXPORT_ID, EXPORT_ID]);
    expect(screen.getByText('Посилання діє годину.')).toBeDefined();
  });

  it('starts with json and keeps polling every 2 s while the export is pending', async () => {
    const { user, sent } = renderControl({ routes: { readyAfterLinks: 3 } });

    expect(screen.getByRole('radio', { name: 'JSON' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Вивантажити' }));
    await screen.findByText('Збираю архів…');
    await advanceBy(POLL_MS);
    await advanceBy(POLL_MS);

    expect(sent.requests.map((request) => request.body)).toEqual([{ format: 'json' }]);
    expect(sent.links).toHaveLength(3);
    expect(screen.queryByRole('link', DOWNLOAD)).toBeNull();

    await advanceBy(POLL_MS);

    expect(await screen.findByRole('link', DOWNLOAD)).toBeDefined();
  });

  it('an export id from the notification reads its link without asking for a new archive', async () => {
    const { sent } = renderControl({ exportId: EXPORT_ID, routes: { readyAfterLinks: 0 } });

    expect(await screen.findByRole('link', DOWNLOAD)).toBeDefined();
    expect(sent.requests).toEqual([]);
  });

  it('an export a newer one replaced says the archive is gone and stops polling', async () => {
    const { sent } = renderControl({
      exportId: EXPORT_ID,
      routes: { link: () => errorReply({ status: 404, type: 'not_found' }) },
    });

    expect(await screen.findByText('Цього архіву вже немає. Вивантаж дані ще раз.')).toBeDefined();
    await advanceBy(POLL_MS);

    expect(sent.links).toEqual([EXPORT_ID]);
    expect(screen.queryByText('Збираю архів…')).toBeNull();
  });

  it('a refused request says so and leaves the button to try again', async () => {
    const { user } = renderControl();
    server.use(
      http.post(apiUrl('/me/export'), () => errorReply({ status: 500, type: 'internal_error' })),
    );

    await user.click(screen.getByRole('button', { name: 'Вивантажити' }));

    expect(await screen.findByText('Не вдалося почати вивантаження')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Вивантажити' })).toBeDefined();
    expect(screen.queryByText('Збираю архів…')).toBeNull();
  });

  it('storage that does not answer shows the failure with a retry that reads the link again', async () => {
    let storageDown = true;
    const { user, sent } = renderControl({
      exportId: EXPORT_ID,
      routes: {
        link: () =>
          storageDown
            ? errorReply({ status: 503, type: 'service_unavailable' })
            : Response.json(EXPORT_LINK),
      },
    });

    await advancePastQueryRetries();
    const retry = await screen.findByRole('button', { name: 'Спробувати ще раз' });
    storageDown = false;
    await user.click(retry);

    expect(await screen.findByRole('link', DOWNLOAD)).toBeDefined();
    expect(sent.links.length).toBeGreaterThan(1);
  });

  it('an export still pending after the poll bound shows the failed state with a retry', async () => {
    const { user, sent } = renderControl({
      exportId: EXPORT_ID,
      routes: { readyAfterLinks: 60, acceptedId: NEXT_EXPORT_ID },
    });

    expect(await screen.findByText('Збираю архів…')).toBeDefined();
    await advanceBy(POLL_MS * 60);
    const retry = await screen.findByRole('button', { name: 'Спробувати ще раз' });
    expect(sent.links).toHaveLength(60);
    expect(screen.queryByText('Збираю архів…')).toBeNull();
    await user.click(retry);

    expect(await screen.findByRole('link', DOWNLOAD)).toBeDefined();
    expect(sent.requests).toEqual([
      { body: { format: 'json' }, idempotencyKey: ANY_IDEMPOTENCY_KEY },
    ]);
    expect(sent.links.slice(60)).toEqual([NEXT_EXPORT_ID]);
  });
});
