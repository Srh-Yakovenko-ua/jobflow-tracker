import type { ApplicationResponse } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION, deleteRoute } from '@/test/application-fixtures';
import type { MoveRouteOptions } from '@/test/board-fixtures';
import { holdExitAnimations } from '@/test/held-exits';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import {
  type DeleteApplicationActions,
  DeleteApplicationDialog,
} from './delete-application-dialog';

const DIALOG = { name: 'Видалити картку?' } as const;

function renderDialog(control: MoveRouteOptions = {}) {
  const route = deleteRoute(control);
  server.use(route.handler);
  const actions = { onCancel: vi.fn<() => void>(), onDeleted: vi.fn<() => void>() };
  const user = renderInApp(
    <DeleteApplicationDialog application={ACME_APPLICATION} actions={actions} />,
  );
  return { user, actions, deletes: route.sent };
}

function ClosingDialog({ onDeleted }: Readonly<Pick<DeleteApplicationActions, 'onDeleted'>>) {
  const [application, setApplication] = useState<ApplicationResponse | null>(ACME_APPLICATION);
  const onCancel = () => {
    setApplication(null);
  };
  return <DeleteApplicationDialog application={application} actions={{ onCancel, onDeleted }} />;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DeleteApplicationDialog', () => {
  it('names the position and says the card leaves the board', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', DIALOG);
    expect(dialog.textContent).toContain(
      'Картка «Senior React Developer» зникне з дошки. Відновити її не вийде.',
    );
  });

  it('Видалити sends one DELETE and reports the card deleted', async () => {
    const { user, actions, deletes } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Видалити' }));

    await waitFor(() => {
      expect(actions.onDeleted).toHaveBeenCalledTimes(1);
    });
    expect(deletes).toEqual([ACME_APPLICATION.id]);
  });

  it('Скасувати closes it and sends nothing', async () => {
    const { user, actions, deletes } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Скасувати' }));

    expect(actions.onCancel).toHaveBeenCalledTimes(1);
    expect(deletes).toEqual([]);
  });

  it('a click on Видалити while the dialog closes after Скасувати sends nothing', async () => {
    const route = deleteRoute();
    server.use(route.handler);
    const exits = holdExitAnimations();
    const onDeleted = vi.fn<() => void>();
    const user = renderInApp(<ClosingDialog onDeleted={onDeleted} />);
    const dialog = screen.getByRole('dialog', DIALOG);

    await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }));
    expect(dialog.isConnected).toBe(true);
    expect(dialog.dataset.state).toBe('closed');
    const confirm = within(dialog).getByRole('button', { name: 'Видалити' });
    await user.click(confirm);

    exits.finish();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(route.sent).toEqual([]);
  });

  it('a failed delete says so and keeps the dialog open', async () => {
    const { user, actions, deletes } = renderDialog({
      reply: () => errorReply({ status: 500, type: 'internal_error' }),
    });

    await user.click(screen.getByRole('button', { name: 'Видалити' }));

    expect(await screen.findByText('Не вдалося видалити')).toBeDefined();
    expect(screen.getByRole('dialog', DIALOG)).toBeDefined();
    expect(actions.onDeleted).not.toHaveBeenCalled();
    expect(deletes).toEqual([ACME_APPLICATION.id]);
  });
});
