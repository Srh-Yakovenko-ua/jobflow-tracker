import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { FileStorage } from '../../storage/file-storage.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import { OLENA, signUp } from '../../test/auth.js';
import { createResumeVersion } from '../../test/factories.js';
import { StorageHeldFileStorage } from '../../test/file-storage.js';
import { callRoute, statusAndDetail } from '../../test/http.js';
import { PDF, PDF_BYTES, postResumeVersion, resumeVersionPath } from '../../test/resumes.js';
import { outcomeWithin } from '../../test/tcp-proxy.js';
import { pendingResumeKey } from './resume-storage-key.js';

const STORAGE_DOWN = [503, 'File storage did not answer'];

const ANSWER_LIMIT_MS = DEPENDENCY_LIMITS.storageTimeoutMs + 1000;

describe('resume versions while file storage is held', () => {
  const storage = new StorageHeldFileStorage();
  const testApp = useTestApp(() =>
    appTestingModule().overrideProvider(FileStorage).useValue(storage),
  );

  it(
    'answers two concurrent POSTs with 503 within the storage limit once the copy outlasts it and creates no version',
    { timeout: 3 * DEPENDENCY_LIMITS.storageTimeoutMs },
    async () => {
      const { accessToken, user } = await signUp(testApp.app, OLENA);
      const uploadIds = [randomUUID(), randomUUID()];
      for (const uploadId of uploadIds) {
        storage.objects.set(pendingResumeKey({ userId: user.id, uploadId, mime: PDF }), {
          bytes: PDF_BYTES,
          mime: PDF,
        });
      }

      const posts = Promise.all(
        uploadIds.map((uploadId) =>
          postResumeVersion(testApp.app, { accessToken, ticket: { uploadId } }),
        ),
      );

      expect(await outcomeWithin(posts, ANSWER_LIMIT_MS)).toBe('answered');
      expect((await posts).map(statusAndDetail)).toEqual([STORAGE_DOWN, STORAGE_DOWN]);
      expect(await testApp.prisma.resumeVersion.count()).toBe(0);
    },
  );

  it('answers a DELETE with 503 when storage refuses the delete and keeps the version', async () => {
    const { accessToken, user } = await signUp(testApp.app, OLENA);
    const id = await createResumeVersion(testApp.prisma, user.id);

    const response = await callRoute(testApp.app, {
      method: 'delete',
      path: resumeVersionPath(id),
      accessToken,
    });

    expect(statusAndDetail(response)).toEqual(STORAGE_DOWN);
    expect(await testApp.prisma.resumeVersion.findMany({ select: { id: true } })).toEqual([{ id }]);
  });
});
