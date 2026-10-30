import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AiQueuePanel, FileTooBigPanel, LoadFailedPanel, OfflinePanel } from './error-panel';

const MEBIBYTE = 1024 * 1024;

const SYNCED_AT = new Date('2026-09-07T12:42:00Z');

const STRIPE = 'inset-shadow-[3px_0_0_var(--color-rejected)]';

function noop() {
  return undefined;
}

describe('error panels', () => {
  it.each<{ name: string; panel: ReactElement; safe: string }>([
    {
      name: 'offline',
      panel: <OfflinePanel key="offline" lastSyncedAt={SYNCED_AT} onRetry={noop} />,
      safe: 'Усе збережене раніше ціле.',
    },
    {
      name: 'AI queue',
      panel: <AiQueuePanel key="queue" queue={{ queued: 47, etaMinutes: 4, waiting: 3 }} />,
      safe: 'нічого не втрачено',
    },
    {
      name: 'file too big',
      panel: (
        <FileTooBigPanel
          key="file"
          file={{ sizeBytes: 9 * MEBIBYTE, limitBytes: 5 * MEBIBYTE }}
          onPick={noop}
        />
      ),
      safe: 'Нічого не втрачено.',
    },
    {
      name: 'load failed',
      panel: <LoadFailedPanel key="load" onRetry={noop} />,
      safe: 'збережені дані на місці',
    },
  ])(
    'the $name panel says the data is safe, on a terracotta stripe, never a red fill',
    ({ panel, safe }) => {
      render(panel);
      const alert = screen.getByRole('alert');

      expect(alert.textContent).toContain(safe);
      expect(alert.className).toContain(STRIPE);
      expect(alert.outerHTML).not.toContain('bg-danger');
    },
  );

  it('offline shows the last sync on the Kyiv clock and retries on press', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<OfflinePanel lastSyncedAt={SYNCED_AT} timeZone="Europe/Kyiv" onRetry={onRetry} />);

    expect(screen.getByText("Немає зв'язку")).toBeDefined();
    expect(
      screen.getByText('Усе збережене раніше ціле. Аналітика поки показує дані на 15:42.'),
    ).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Спробувати зараз' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      queue: { queued: 47, etaMinutes: 4, waiting: 3 },
      body: 'У черзі 47 задач, орієнтовно 4 хвилини.',
      waiting: '3 карточки чекають',
    },
    {
      queue: { queued: 21, etaMinutes: 1, waiting: 1 },
      body: 'У черзі 21 задача, орієнтовно 1 хвилина.',
      waiting: '1 карточка чекає',
    },
  ])(
    'the AI queue counts $queue.queued tasks, minutes and waiting cards in Ukrainian plurals',
    ({ queue, body, waiting }) => {
      render(<AiQueuePanel queue={queue} />);

      expect(screen.getByRole('alert').textContent).toContain(body);
      expect(screen.getByText(waiting)).toBeDefined();
    },
  );

  it('a file too big names its size and the limit in megabytes and offers another file', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <FileTooBigPanel file={{ sizeBytes: 8_808_038, limitBytes: 5 * MEBIBYTE }} onPick={onPick} />,
    );

    expect(screen.getByText('Резюме важить 8,4 МБ')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('Максимум — 5 МБ.');
    await user.click(screen.getByRole('button', { name: 'Обрати інший файл' }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('a failed load blames the system and retries on press', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<LoadFailedPanel onRetry={onRetry} />);

    expect(screen.getByText('Не вдалося завантажити')).toBeDefined();
    expect(screen.getByText('Це збій на нашому боці, збережені дані на місці.')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
