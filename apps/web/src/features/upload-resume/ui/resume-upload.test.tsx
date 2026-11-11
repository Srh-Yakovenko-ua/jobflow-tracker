import { RESUME_UPLOAD_LIMITS } from '@jobflow/shared';
import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { FILE_UPLOAD_LIMITS } from '@/shared/api';
import { useFilePicker } from '@/shared/ui/drop-zone';
import {
  ANY_IDEMPOTENCY_KEY,
  apiUrl,
  errorReply,
  NEVER_ANSWERS,
  type Outage,
  REFUSED_CONNECTION,
  validationReply,
} from '@/test/api-handlers';
import { fixtureIdOf } from '@/test/board-fixtures';
import { advanceBy, fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import {
  buildResumeVersion,
  resumeRoutes,
  type ResumeRoutesOptions,
  UPLOAD_ID,
} from '@/test/resume-fixtures';
import { server } from '@/test/server';
import { storageReply } from '@/test/storage-handlers';

import { ResumeUpload } from './resume-upload';

vi.mock('next/navigation', () => import('@/test/navigation'));

const MEBIBYTE = 1024 * 1024;

const PICK = 'Обрати файл';

const TITLE = 'Назва версії';

const SUBMIT = { name: 'Завантажити' } as const;

const PICK_ANOTHER = { name: 'Обрати інший файл' } as const;

const PROGRESS = { name: 'Завантаження файлу' } as const;

const TOO_BIG = 'Резюме важить 6 МБ';

const SAVE_FAILED = 'Не вдалося зберегти';

const RESUME = new File([new Uint8Array(2048)], 'andrii_cv_v2.pdf', { type: 'application/pdf' });

function sizedResume(sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], 'andrii_cv_heavy.pdf', { type: 'application/pdf' });
}

function UploadPanel() {
  const picker = useFilePicker();
  return (
    <>
      <QueryProbe queryKey={userKeys.me()} />
      <ResumeUpload view={{ size: 'panel' }} picker={picker} />
    </>
  );
}

async function renderUpload(options: ResumeRoutesOptions = {}) {
  const routes = resumeRoutes(options);
  server.use(...routes.handlers);
  const user = renderInApp(<UploadPanel />);
  await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
  return { user, routes };
}

async function pickAndSend({ user, file }: Readonly<{ user: UserEvent; file: File }>) {
  await user.upload(screen.getByLabelText(PICK), file);
  await user.click(screen.getByRole('button', SUBMIT));
}

function countPickerOpens(): { opened: number } {
  const counted = { opened: 0 };
  screen.getByLabelText(PICK).addEventListener('click', () => {
    counted.opened += 1;
  });
  return counted;
}

function heldStorage() {
  const storage = latch();
  return {
    storage,
    reply: async () => {
      await storage.reached;
      return storageReply(200);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  toast.dismiss();
});

describe('ResumeUpload', () => {
  it('a 6 MB file shows the size refusal without asking for a ticket, and its button reopens the picker', async () => {
    const { user, routes } = await renderUpload();

    await user.upload(screen.getByLabelText(PICK), sizedResume(6 * MEBIBYTE));
    const picker = countPickerOpens();
    await user.click(screen.getByRole('button', PICK_ANOTHER));

    expect(screen.getByText(TOO_BIG)).toBeDefined();
    expect(screen.queryByRole('button', SUBMIT)).toBeNull();
    expect(routes.sent.tickets).toEqual([]);
    expect(picker.opened).toBe(1);
  });

  it('a ticket refused on sizeBytes shows the same size refusal', async () => {
    const { user, routes } = await renderUpload({
      ticket: () => validationReply([{ path: 'sizeBytes', message: 'too big' }]),
    });

    await pickAndSend({ user, file: sizedResume(RESUME_UPLOAD_LIMITS.maxBytes) });

    expect(await screen.findByText('Резюме важить 5 МБ')).toBeDefined();
    expect(screen.getByRole('button', PICK_ANOTHER)).toBeDefined();
    expect(routes.sent.stored).toEqual([]);
  });

  it('the title is prefilled from the file name, and one upload sends ticket, file, confirm and version once each under one key while the bar shows progress', async () => {
    const { storage, reply } = heldStorage();
    const { user, routes } = await renderUpload({ storage: reply });

    await user.upload(screen.getByLabelText(PICK), RESUME);
    expect(screen.getByLabelText<HTMLInputElement>(TITLE).value).toBe('andrii_cv_v2');
    await user.click(screen.getByRole('button', SUBMIT));
    expect(await screen.findByRole('progressbar', PROGRESS)).toBeDefined();
    storage.release();

    await waitFor(() => {
      expect(screen.queryByLabelText(TITLE)).toBeNull();
    });
    expect(routes.sent.tickets).toEqual([
      { filename: RESUME.name, mime: RESUME.type, sizeBytes: RESUME.size },
    ]);
    expect(routes.sent.stored).toEqual([RESUME.size]);
    expect(routes.sent.confirms).toEqual([UPLOAD_ID]);
    expect(routes.sent.created).toEqual([
      {
        body: {
          uploadId: UPLOAD_ID,
          filename: RESUME.name,
          mime: RESUME.type,
          title: 'andrii_cv_v2',
        },
        idempotencyKey: ANY_IDEMPOTENCY_KEY,
      },
    ]);
  });

  it('the first upload with no active version makes the new version the active one', async () => {
    const { user, routes } = await renderUpload();

    await pickAndSend({ user, file: RESUME });

    await waitFor(() => {
      expect(routes.sent.activated).toEqual([fixtureIdOf(900)]);
    });
    expect(routes.sent.created).toHaveLength(1);
  });

  it('a first upload whose activation fails keeps the one created version and says the save failed', async () => {
    const { user, routes } = await renderUpload();
    server.use(
      http.post(apiUrl('/resumes/versions/:id/activate'), () =>
        errorReply({ status: 500, type: 'internal_error' }),
      ),
    );

    await pickAndSend({ user, file: RESUME });

    await waitFor(() => {
      expect(screen.queryByLabelText(TITLE)).toBeNull();
    });
    expect(screen.getByText(SAVE_FAILED)).toBeDefined();
    expect(routes.sent.tickets).toHaveLength(1);
    expect(routes.sent.created).toHaveLength(1);
  });

  it('a file picked while an upload runs is ignored, so one ticket goes out and the form keeps the first file', async () => {
    const { storage, reply } = heldStorage();
    const { user, routes } = await renderUpload({ storage: reply });

    await pickAndSend({ user, file: RESUME });
    expect(await screen.findByRole('progressbar', PROGRESS)).toBeDefined();
    await user.upload(screen.getByLabelText(PICK), sizedResume(4096));
    expect(screen.getByLabelText<HTMLInputElement>(TITLE).value).toBe('andrii_cv_v2');
    expect(screen.getByText(RESUME.name)).toBeDefined();
    storage.release();

    await waitFor(() => {
      expect(screen.queryByLabelText(TITLE)).toBeNull();
    });
    expect(routes.sent.tickets).toHaveLength(1);
    expect(routes.sent.created).toHaveLength(1);
  });

  it('an upload beside an active version leaves the active version alone', async () => {
    const active = buildResumeVersion();
    const { user, routes } = await renderUpload({ items: [active], activeId: active.id });

    await pickAndSend({ user, file: RESUME });

    await waitFor(() => {
      expect(screen.queryByLabelText(TITLE)).toBeNull();
    });
    expect(routes.sent.created).toHaveLength(1);
    expect(routes.sent.activated).toEqual([]);
  });

  it.each<Outage>([REFUSED_CONNECTION, NEVER_ANSWERS])(
    'a storage that $name ends in the retry banner with the picked file kept',
    async ({ reply, settled }) => {
      fakeTimeouts();
      const { user, routes } = await renderUpload({ storage: reply });

      await pickAndSend({ user, file: RESUME });
      if (settled === 'pending') await advanceBy(FILE_UPLOAD_LIMITS.putTimeoutMs);

      expect(await screen.findByText(SAVE_FAILED)).toBeDefined();
      expect(screen.getByText(RESUME.name)).toBeDefined();
      expect(screen.getByLabelText<HTMLInputElement>(TITLE).value).toBe('andrii_cv_v2');
      expect(screen.getByRole<HTMLButtonElement>('button', SUBMIT).disabled).toBe(false);
      expect(routes.sent.confirms).toEqual([]);
      expect(routes.sent.created).toEqual([]);
    },
  );
});
