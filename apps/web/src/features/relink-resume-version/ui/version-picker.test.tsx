import type { ApplicationResponse } from '@jobflow/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import type { MoveRouteOptions } from '@/test/board-fixtures';
import { latch } from '@/test/latch';
import {
  ARCHIVED_VERSION,
  DESIGN_VERSIONS,
  MATCHED_APPLICATION,
  NEXT_VERSION,
} from '@/test/match-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { resumeRoutes } from '@/test/resume-fixtures';
import { server } from '@/test/server';

import { VersionPicker } from './version-picker';

const TRIGGER = { name: 'Змінити версію' } as const;

function renderPicker(application: ApplicationResponse, relink: MoveRouteOptions = {}) {
  const routes = resumeRoutes({ items: [...DESIGN_VERSIONS], relink });
  server.use(...routes.handlers);
  const onRelinked = vi.fn();
  const user = renderInApp(
    <VersionPicker application={application} versions={DESIGN_VERSIONS} actions={{ onRelinked }} />,
  );
  return { user, onRelinked, sent: routes.sent };
}

describe('VersionPicker', () => {
  it('offers the versions not archived with the linked one checked', async () => {
    const { user } = renderPicker(MATCHED_APPLICATION);

    await user.click(screen.getByRole('button', TRIGGER));

    const items = await screen.findAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'CV v3 · для дизайн-ролей',
      'CV v2 · акцент на продукті',
    ]);
    expect(items[1]?.getAttribute('aria-checked')).toBe('true');
  });

  it('keeps an archived version in the list while it is the linked one', async () => {
    const { user } = renderPicker({ ...MATCHED_APPLICATION, resumeVersionId: ARCHIVED_VERSION.id });

    await user.click(screen.getByRole('button', TRIGGER));

    expect(
      await screen.findByRole('menuitemradio', { name: 'CV v1 · хронологічне', checked: true }),
    ).toBeDefined();
  });

  it('picking another version links it and reports it relinked', async () => {
    const { user, sent, onRelinked } = renderPicker(MATCHED_APPLICATION);

    await user.click(screen.getByRole('button', TRIGGER));
    await user.click(await screen.findByRole('menuitemradio', { name: /CV v3/ }));

    await waitFor(() => {
      expect(onRelinked).toHaveBeenCalledWith(NEXT_VERSION.id);
    });
    expect(sent.relinked).toEqual([
      { applicationId: MATCHED_APPLICATION.id, resumeVersionId: NEXT_VERSION.id },
    ]);
  });

  it('picking the linked version closes the menu and sends nothing', async () => {
    const { user, sent, onRelinked } = renderPicker(MATCHED_APPLICATION);

    await user.click(screen.getByRole('button', TRIGGER));
    await user.click(await screen.findByRole('menuitemradio', { name: /CV v2/ }));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(sent.relinked).toEqual([]);
    expect(onRelinked).not.toHaveBeenCalled();
  });

  it('while the link is saved the trigger stays disabled and opens no menu', async () => {
    const held = latch();
    const { user, sent } = renderPicker(MATCHED_APPLICATION, { latch: held });
    await user.click(screen.getByRole('button', TRIGGER));
    await user.click(await screen.findByRole('menuitemradio', { name: /CV v3/ }));
    await waitFor(() => {
      expect(sent.relinked).toHaveLength(1);
    });
    const trigger = screen.getByRole('button', TRIGGER);

    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    await user.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
    held.release();
    await waitFor(() => {
      expect(trigger.getAttribute('aria-disabled')).toBeNull();
    });
    expect(sent.relinked).toHaveLength(1);
  });

  it('a version gone on the server says so and reports nothing relinked', async () => {
    const { user, onRelinked } = renderPicker(MATCHED_APPLICATION, {
      reply: () => errorReply({ status: 404, type: 'not_found' }),
    });

    await user.click(screen.getByRole('button', TRIGGER));
    await user.click(await screen.findByRole('menuitemradio', { name: /CV v3/ }));

    expect(await screen.findByText('Цієї версії вже немає')).toBeDefined();
    expect(onRelinked).not.toHaveBeenCalled();
  });
});
