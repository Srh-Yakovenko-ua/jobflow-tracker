import { randomUUID } from 'node:crypto';

import {
  exportAcceptedSchema,
  parseCsv,
  readyExportLinkSchema,
  stageHistoryOf,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import {
  EXPORT_PATH,
  type ExportCall,
  exportedThroughWorker,
  exportLinkPath,
  postExport,
  zipFilesOf,
} from '../../test/account.js';
import { useTestApp } from '../../test/app.js';
import {
  createApplication,
  postStageMove,
  ROMASHKA,
  signedInWithSearch,
  undoLastMove,
} from '../../test/applications.js';
import { createResumeVersion } from '../../test/factories.js';
import { callRoute, errorPathsOf, statusAndType } from '../../test/http.js';
import { expectReplayedCreate } from '../../test/idempotency.js';
import { outboxRows } from '../../test/outbox.js';
import { SCREENING_TO_TECH_INTERVIEW, TO_SCREENING } from '../../test/service-fixtures.js';

const HISTORY_COLUMN = 7;

describe('the data export API', () => {
  const testApp = useTestApp();

  const linkOf = (accessToken: string, exportId: string) =>
    callRoute(testApp.app, { method: 'get', path: exportLinkPath(exportId), accessToken });

  async function downloadedFiles(call: ExportCall, exportId: string) {
    const response = await linkOf(call.accessToken, exportId);
    expect(response.status).toBe(200);
    const download = await fetch(readyExportLinkSchema.parse(response.body).url);
    return zipFilesOf(new Uint8Array(await download.arrayBuffer()));
  }

  it('answers 202 with an export id and writes export.requested for the worker', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    const response = await postExport(testApp.app, {
      accessToken: olena.accessToken,
      format: 'csv',
    });

    expect(response.status).toBe(202);
    const { exportId } = exportAcceptedSchema.parse(response.body);
    expect(await outboxRows(testApp.prisma, { eventType: 'export.requested' })).toEqual([
      {
        aggregate: 'user',
        aggregateId: olena.userId,
        eventType: 'export.requested',
        payload: {
          userId: olena.userId,
          exportId,
          format: 'csv',
          requestId: response.get('x-request-id'),
        },
      },
    ]);
  });

  it('answers the first export id again to a repeated Idempotency-Key and writes one event', async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    await expectReplayedCreate({
      app: testApp.app,
      call: { method: 'post', path: EXPORT_PATH, accessToken, body: { format: 'json' } },
      countRows: async () => [
        (await outboxRows(testApp.prisma, { eventType: 'export.requested' })).length,
      ],
      status: 202,
    });
  });

  it('answers 422 on path format to a format it does not write and writes nothing', async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    const response = await callRoute(testApp.app, {
      method: 'post',
      path: EXPORT_PATH,
      accessToken,
      body: { format: 'xlsx' },
    });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['format']]);
    expect(await outboxRows(testApp.prisma, { eventType: 'export.requested' })).toEqual([]);
  });

  it('answers pending before the worker built the zip, then a link valid one hour, and 404 once a newer export replaced it', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const { exportId } = exportAcceptedSchema.parse(
      (await postExport(testApp.app, { accessToken: olena.accessToken, format: 'csv' })).body,
    );
    const pending = await linkOf(olena.accessToken, exportId);
    expect([pending.status, pending.body]).toEqual([200, { status: 'pending' }]);

    const built = await exportedThroughWorker(testApp, {
      accessToken: olena.accessToken,
      format: 'csv',
    });
    const response = await linkOf(olena.accessToken, built);

    const link = readyExportLinkSchema.parse(response.body);
    expect([response.status, new URL(link.url).searchParams.get('X-Amz-Expires')]).toEqual([
      200,
      '3600',
    ]);
    expect(statusAndType(await linkOf(olena.accessToken, exportId))).toEqual([404, 'not_found']);
  });

  it('answers 404 to an export id never requested', async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    expect(statusAndType(await linkOf(accessToken, randomUUID()))).toEqual([404, 'not_found']);
  });

  it("answers 404 to another user's pending export id", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const { exportId } = exportAcceptedSchema.parse(
      (await postExport(testApp.app, { accessToken: olena.accessToken, format: 'csv' })).body,
    );

    expect(statusAndType(await linkOf(bohdan.accessToken, exportId))).toEqual([404, 'not_found']);
  });

  it("answers 404 to another user's export id", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const exportId = await exportedThroughWorker(testApp, {
      accessToken: olena.accessToken,
      format: 'json',
    });

    expect(statusAndType(await linkOf(bohdan.accessToken, exportId))).toEqual([404, 'not_found']);
  });

  it('exports only the own applications with their effective moves and records export_ready', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const call = { accessToken: olena.accessToken, format: 'csv' } as const;
    const { id } = await createApplication(testApp.app, {
      accessToken: olena.accessToken,
      input: ROMASHKA,
    });
    for (const input of [TO_SCREENING, SCREENING_TO_TECH_INTERVIEW]) {
      await postStageMove(testApp.app, { accessToken: olena.accessToken, id, input });
    }
    await undoLastMove(testApp.app, { accessToken: olena.accessToken, id });
    await createApplication(testApp.app, {
      accessToken: bohdan.accessToken,
      input: { company: 'Чужа компанія', position: 'QA' },
    });
    const versionId = await createResumeVersion(testApp.prisma, olena.userId);
    await createResumeVersion(testApp.prisma, bohdan.userId);

    const exportId = await exportedThroughWorker(testApp, call);
    const files = await downloadedFiles(call, exportId);
    const [header, ...rows] = parseCsv(files['applications.csv'] ?? '');

    expect(rows.map((row) => [row[0], row[1], row[4]])).toEqual([
      ['Ромашка', 'Backend developer', 'screening'],
    ]);
    expect(parseCsv(files['resume_versions.csv'] ?? '').map(([column]) => column)).toEqual([
      'id',
      versionId,
    ]);
    expect(header?.[HISTORY_COLUMN]).toBe('stage_history');
    expect(stageHistoryOf(rows[0]?.[HISTORY_COLUMN] ?? '')).toMatchObject([
      { toStage: 'applied', reasonCode: null },
      { toStage: 'screening', reasonCode: null },
    ]);
    expect(
      await testApp.prisma.notification.findMany({
        select: { userId: true, type: true, payload: true },
      }),
    ).toEqual([
      { userId: olena.userId, type: 'export_ready', payload: { exportId, format: 'csv' } },
    ]);
  });

  it.each([
    { method: 'post', path: EXPORT_PATH },
    { method: 'get', path: exportLinkPath(randomUUID()) },
  ] as const)('answers 401 to $method $path without a token', async (call) => {
    expect((await callRoute(testApp.app, call)).status).toBe(401);
  });

  it('answers 422 to a link of an export id that is not a uuid', async () => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    expect(statusAndType(await linkOf(accessToken, 'not-a-uuid'))).toEqual([
      422,
      'validation_error',
    ]);
  });
});
