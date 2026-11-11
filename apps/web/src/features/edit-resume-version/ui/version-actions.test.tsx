import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resumeVersionsQueryOptions } from '@/entities/resume';
import { useSession } from '@/entities/user';
import { apiUrl, errorReply, validationReply } from '@/test/api-handlers';
import { renderInApp } from '@/test/render-in-app';
import {
  buildResumeVersion,
  buildResumeVersions,
  downloadUrlOf,
  resumeRoutes,
  type ResumeRoutesOptions,
} from '@/test/resume-fixtures';
import { server } from '@/test/server';

import { VersionActions } from './version-actions';

vi.mock('next/navigation', () => import('@/test/navigation'));

const [NEWER, OLDER] = buildResumeVersions(2);

const ACTIVATE = { name: 'Зробити активною' } as const;

const RENAME = { name: 'Перейменувати' } as const;

const ARCHIVE = { name: 'В архів' } as const;

const RESTORE = { name: 'Повернути з архіву' } as const;

const TITLE = 'Назва версії';

const TITLE_ERROR = 'Назва потрібна, до 120 символів';

const PREVIEW_FAILED = 'Не вдалося завантажити';

const CURRENT = 'CV v1 · акцент на продукті';

const PREVIEW = { name: `Відкрити PDF: ${CURRENT}` } as const;

const ACTIVE_PROBE = 'active version';

const ARCHIVED_PROBE = 'archived versions';

function actionsOf(label: string) {
  return { name: `Дії з версією ${label}` } as const;
}

function VersionsList() {
  const { data } = useQuery(resumeVersionsQueryOptions());
  const activeId = useSession().settings?.activeResumeVersionId;
  const items = data?.items ?? [];
  return (
    <>
      <output aria-label={ACTIVE_PROBE}>{activeId}</output>
      <output aria-label={ARCHIVED_PROBE}>
        {items.filter((version) => version.isArchived).length}
      </output>
      <ul>
        {items.map((version) => (
          <li key={version.id}>
            <VersionActions version={version} view={{ active: version.id === activeId }} />
          </li>
        ))}
      </ul>
    </>
  );
}

async function probeShows({ probe, text }: Readonly<{ probe: string; text: string }>) {
  await waitFor(() => {
    expect(screen.getByLabelText(probe).textContent).toBe(text);
  });
}

async function renderVersions(options: ResumeRoutesOptions) {
  const routes = resumeRoutes(options);
  server.use(...routes.handlers);
  const user = renderInApp(<VersionsList />);
  await screen.findAllByRole('button', { name: /^Дії з версією/ });
  return { user, routes };
}

async function openMenu({ user, label }: Readonly<{ user: UserEvent; label: string }>) {
  await user.click(await screen.findByRole('button', actionsOf(label)));
  return within(await screen.findByRole('menu'));
}

async function choose({
  user,
  label,
  item,
}: Readonly<{ user: UserEvent; label: string; item: { name: string } }>) {
  const menu = await openMenu({ user, label });
  await user.click(menu.getByRole('menuitem', item));
}

function fakeTab() {
  const tab = {
    opener: window,
    location: { assign: vi.fn<(url: string) => void>() },
    close: vi.fn<() => void>(),
  };
  vi.stubGlobal('open', () => tab);
  return tab;
}

afterEach(() => {
  vi.unstubAllGlobals();
  toast.dismiss();
});

describe('VersionActions', () => {
  it('making an older version active sends the activation, and its menu then stops offering it', async () => {
    if (NEWER === undefined || OLDER === undefined) throw new Error('two versions expected');
    const { user, routes } = await renderVersions({ items: [NEWER, OLDER], activeId: NEWER.id });

    await choose({ user, label: 'CV v1 · версія 1', item: ACTIVATE });

    await probeShows({ probe: ACTIVE_PROBE, text: OLDER.id });
    const reopened = await openMenu({ user, label: 'CV v1 · версія 1' });
    expect(reopened.queryByRole('menuitem', ACTIVATE)).toBeNull();
    expect(routes.sent.activated).toEqual([OLDER.id]);
  });

  it('the active and the archived versions offer no activation', async () => {
    const archived = buildResumeVersion({ isArchived: true });
    if (NEWER === undefined) throw new Error('a version expected');
    const { user } = await renderVersions({ items: [NEWER, archived], activeId: NEWER.id });

    const activeMenu = await openMenu({ user, label: 'CV v2 · версія 2' });
    expect(activeMenu.queryByRole('menuitem', ACTIVATE)).toBeNull();
    await user.keyboard('{Escape}');
    const archivedMenu = await openMenu({ user, label: CURRENT });

    expect(archivedMenu.queryByRole('menuitem', ACTIVATE)).toBeNull();
    expect(archivedMenu.getByRole('menuitem', RESTORE)).toBeDefined();
  });

  it('archiving sends the archive flag, the refreshed row offers a restore, and the restore sends it back', async () => {
    const version = buildResumeVersion();
    const { user, routes } = await renderVersions({ items: [version] });

    await choose({ user, label: CURRENT, item: ARCHIVE });
    await probeShows({ probe: ARCHIVED_PROBE, text: '1' });
    await choose({ user, label: CURRENT, item: RESTORE });

    await probeShows({ probe: ARCHIVED_PROBE, text: '0' });
    expect(routes.sent.updated).toEqual([
      { itemId: version.id, body: { isArchived: true } },
      { itemId: version.id, body: { isArchived: false } },
    ]);
  });

  it('archiving the active version refreshes the session, so no version stays active', async () => {
    const version = buildResumeVersion();
    const { user } = await renderVersions({ items: [version], activeId: version.id });
    await probeShows({ probe: ACTIVE_PROBE, text: version.id });

    await choose({ user, label: CURRENT, item: ARCHIVE });

    await probeShows({ probe: ARCHIVED_PROBE, text: '1' });
    await probeShows({ probe: ACTIVE_PROBE, text: '' });
  });

  it('the rename dialog opens with the title field focused once the menu has closed', async () => {
    const { user } = await renderVersions({ items: [buildResumeVersion()] });

    await choose({ user, label: CURRENT, item: RENAME });
    const title = await screen.findByLabelText(TITLE);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(title);
    });
  });

  it('a rename saves the new title, closes the dialog and the refreshed row carries the new name', async () => {
    const version = buildResumeVersion();
    const { user, routes } = await renderVersions({ items: [version] });

    await choose({ user, label: CURRENT, item: RENAME });
    const title = await screen.findByLabelText<HTMLInputElement>(TITLE);
    expect(title.value).toBe('акцент на продукті');
    await user.clear(title);
    await user.type(title, 'для продуктових');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByRole('button', actionsOf('CV v1 · для продуктових'))).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(routes.sent.updated).toEqual([
      { itemId: version.id, body: { title: 'для продуктових' } },
    ]);
  });

  it('a rename the server refuses on title shows the error under the field and keeps the dialog open', async () => {
    const { user } = await renderVersions({
      items: [buildResumeVersion()],
      update: { reply: () => validationReply([{ path: 'title', message: 'too long' }]) },
    });

    await choose({ user, label: CURRENT, item: RENAME });
    await user.type(await screen.findByLabelText(TITLE), ' 2');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText(TITLE_ERROR)).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('the file button opens a blank tab at once and sends it to the signed link', async () => {
    const version = buildResumeVersion();
    const tab = fakeTab();
    const { user, routes } = await renderVersions({ items: [version] });

    await user.click(screen.getByRole('button', PREVIEW));

    await waitFor(() => {
      expect(tab.location.assign.mock.calls).toEqual([[downloadUrlOf(version.id)]]);
    });
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
    expect(routes.sent.downloaded).toEqual([version.id]);
  });

  it('a file link that fails closes the blank tab and says the file did not come', async () => {
    const version = buildResumeVersion();
    const tab = fakeTab();
    const { user } = await renderVersions({ items: [version] });
    server.use(
      http.get(apiUrl(`/resumes/versions/${version.id}/download`), () =>
        errorReply({ status: 404, type: 'not_found' }),
      ),
    );

    await user.click(screen.getByRole('button', PREVIEW));

    expect(await screen.findByText(PREVIEW_FAILED)).toBeDefined();
    expect(tab.close).toHaveBeenCalledOnce();
    expect(tab.location.assign).not.toHaveBeenCalled();
  });
});
