import { screen, waitFor } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { describe, expect, it } from 'vitest';

import { deleteAiResultsRoute } from '@/test/ai-results-fixtures';
import { errorReply } from '@/test/api-handlers';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { DeleteAiResultsDialog } from './delete-ai-results-dialog';

const TRIGGER = { name: 'Видалити всі AI-результати' } as const;

const DIALOG = { name: 'Видалити всі AI-результати?' } as const;

async function openDialog(reply?: HttpResponseResolver) {
  const route = deleteAiResultsRoute(reply);
  server.use(route.handler);
  const user = renderInApp(<DeleteAiResultsDialog />);
  const trigger = screen.getByRole('button', TRIGGER);
  await user.click(trigger);
  const dialog = await screen.findByRole('alertdialog', DIALOG);
  return { user, trigger, dialog, deletes: route.sent };
}

describe('DeleteAiResultsDialog', () => {
  it('asks first as an alert whose description says the vacancies and resumes stay', async () => {
    const { dialog } = await openDialog();

    expect(screen.getByRole('alertdialog', { description: /^Розбори/ })).toBe(dialog);
    expect(dialog.textContent).toContain(
      'Розбори, Match Score, саммарі, драфти й підготовки зникнуть назавжди. Вакансії, резюме й збережені плани лишаться.',
    );
  });

  it('the alert description says the deletion cannot be undone', async () => {
    await openDialog();

    expect(
      screen.getByRole('alertdialog', {
        description: /зникнуть назавжди\./,
      }),
    ).toBeDefined();
  });

  it('Скасувати closes it and sends nothing', async () => {
    const { user, deletes } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Скасувати' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deletes).toEqual([]);
  });

  it('Видалити sends one DELETE, closes, says so and gives focus back to the trigger', async () => {
    const { user, trigger, deletes } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Видалити' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(deletes).toEqual(['DELETE']);
    expect(document.activeElement).toBe(trigger);
    expect(await screen.findByText('AI-результати видалено')).toBeDefined();
  });

  it('a failed delete says so and keeps the dialog open', async () => {
    const { user, deletes } = await openDialog(() =>
      errorReply({ status: 500, type: 'internal_error' }),
    );

    await user.click(screen.getByRole('button', { name: 'Видалити' }));

    expect(await screen.findByText('Не вдалося видалити AI-результати')).toBeDefined();
    expect(screen.getByRole('alertdialog', DIALOG)).toBeDefined();
    expect(deletes).toEqual(['DELETE']);
  });
});
