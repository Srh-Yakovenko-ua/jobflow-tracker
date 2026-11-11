import type { HttpResponseResolver } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NEVER_ANSWERS,
  type Outage,
  REFUSED_CONNECTION,
  SESSION_TOKENS,
} from '@/test/api-handlers';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { server } from '@/test/server';
import { storageReply, storageRoutes } from '@/test/storage-handlers';

import {
  clearAccessToken,
  FILE_UPLOAD_LIMITS,
  type FileUploadErrorReason,
  putFile,
  setAccessToken,
  type UploadProgress,
} from './index';

const STORAGE_URL = 'http://localhost:9000/resumes/upload-1';

const TICKET_URL = `${STORAGE_URL}?X-Amz-Signature=signed`;

const TICKET_HEADERS = { 'Content-Type': 'application/pdf' } as const;

const RESUME = new File([new Uint8Array(2048)], 'andrii_cv.pdf', { type: 'application/pdf' });

function useStorage(reply: HttpResponseResolver) {
  server.use(...storageRoutes(STORAGE_URL, reply));
}

function upload(signal?: AbortSignal) {
  const progress: UploadProgress[] = [];
  const done = putFile({
    url: TICKET_URL,
    file: RESUME,
    headers: TICKET_HEADERS,
    onProgress: (step) => progress.push(step),
    signal,
  });
  return { done, progress };
}

afterEach(() => {
  vi.useRealTimers();
  clearAccessToken();
});

describe('putFile', () => {
  it('sends the file to the ticket URL, reports progress up to the whole file and resolves', async () => {
    let received = 0;
    useStorage(async ({ request }) => {
      received = (await request.arrayBuffer()).byteLength;
      return storageReply(200);
    });

    const { done, progress } = upload();

    await expect(done).resolves.toBeUndefined();
    expect(received).toBe(2048);
    expect(progress.at(-1)).toEqual({ loaded: 2048, total: 2048 });
  });

  it('sends only the ticket Content-Type, with no access token and no cookies', async () => {
    setAccessToken(SESSION_TOKENS.fresh);
    const sent: {
      contentType: string | null;
      authorization: string | null;
      cookie: string | null;
    }[] = [];
    useStorage(({ request }) => {
      sent.push({
        contentType: request.headers.get('content-type'),
        authorization: request.headers.get('authorization'),
        cookie: request.headers.get('cookie'),
      });
      return storageReply(200);
    });

    await upload().done;

    expect(sent).toEqual([{ contentType: 'application/pdf', authorization: null, cookie: null }]);
  });

  it('a storage refusal with 403 rejects with the status reason', async () => {
    useStorage(() => storageReply(403));

    await expect(upload().done).rejects.toMatchObject({
      name: 'FileUploadError',
      reason: 'status',
    });
  });

  it.each<Outage & { reason: FileUploadErrorReason }>([
    { ...REFUSED_CONNECTION, reason: 'network' },
    { ...NEVER_ANSWERS, reason: 'timeout' },
  ])('a storage that $name rejects as $reason by the upload limit', async ({ reply, reason }) => {
    fakeTimeouts();
    useStorage(reply);

    const failed = expect(upload().done).rejects.toMatchObject({ reason });
    await vi.advanceTimersByTimeAsync(FILE_UPLOAD_LIMITS.putTimeoutMs);

    await failed;
  });

  it('a storage that never answers is still waited for one millisecond before the limit', async () => {
    fakeTimeouts();
    useStorage(NEVER_ANSWERS.reply);
    const controller = new AbortController();
    let failure: unknown;

    void upload(controller.signal).done.catch((error: unknown) => {
      failure = error;
    });
    await vi.advanceTimersByTimeAsync(FILE_UPLOAD_LIMITS.putTimeoutMs - 1);
    const beforeLimit = failure;
    controller.abort();

    expect(beforeLimit).toBeUndefined();
  });

  it('an abort through the signal rejects as aborted', async () => {
    useStorage(NEVER_ANSWERS.reply);
    const controller = new AbortController();

    const failed = expect(upload(controller.signal).done).rejects.toMatchObject({
      reason: 'aborted',
    });
    controller.abort();

    await failed;
  });
});
