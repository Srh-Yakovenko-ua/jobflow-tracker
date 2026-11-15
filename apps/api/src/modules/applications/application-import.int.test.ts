import {
  IMPORT_LIMITS,
  importApplicationsResponseSchema,
  type ImportRowInput,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from '../../test/app.js';
import { APPLICATIONS_IMPORT_PATH, signedInWithSearch } from '../../test/applications.js';
import { createActiveResumeVersion } from '../../test/factories.js';
import { callRoute, statusAndType } from '../../test/http.js';
import { expectReplayedCreate } from '../../test/idempotency.js';
import { outboxRows } from '../../test/outbox.js';

const VELA: ImportRowInput = {
  company: 'Vela',
  position: 'Frontend Engineer',
  source: 'djinni',
  appliedAt: '2026-10-01T09:00:00.000Z',
};

const ILLEGAL_HISTORY = [
  { toStage: 'applied', reasonCode: null, occurredAt: '2026-10-01T09:00:00.000Z' },
  { toStage: 'offer', reasonCode: null, occurredAt: '2026-10-03T09:00:00.000Z' },
];

describe('POST /applications/import', () => {
  const testApp = useTestApp();

  const postImport = (accessToken: string | undefined, rows: unknown[]) =>
    callRoute(testApp.app, {
      method: 'post',
      path: APPLICATIONS_IMPORT_PATH,
      accessToken,
      body: { rows },
    });

  const boardOf = (userId: string) =>
    testApp.prisma.application.findMany({
      where: { userId },
      orderBy: { company: 'asc' },
      select: { company: true, currentStage: true, searchId: true },
    });

  const linkedVersionsOf = async (userId: string) =>
    (
      await testApp.prisma.application.findMany({
        where: { userId },
        select: { resumeVersionId: true },
      })
    ).map(({ resumeVersionId }) => resumeVersionId);

  it('imports the valid rows into the active search and reports the others by row and path', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);

    const response = await postImport(olena.accessToken, [
      { ...VELA, stage: 'final' },
      { position: 'QA', appliedAt: VELA.appliedAt },
      { ...VELA, company: 'Future', appliedAt: '2999-01-01T00:00:00.000Z' },
      { ...VELA, company: 'Unknown', stage: 'interview' },
      { ...VELA, company: 'Illegal', stageHistory: ILLEGAL_HISTORY },
      { ...VELA, company: 'Ромашка' },
    ]);

    expect(response.status).toBe(200);
    const result = importApplicationsResponseSchema.parse(response.body);
    expect(result.imported).toBe(2);
    expect(result.errors.map(({ row, path }) => [row, path])).toEqual([
      [1, 'company'],
      [2, 'appliedAt'],
      [3, 'stage'],
      [4, 'stageHistory.1.toStage'],
    ]);
    expect(await boardOf(olena.userId)).toEqual([
      { company: 'Vela', currentStage: 'final', searchId: olena.searchId },
      { company: 'Ромашка', currentStage: 'applied', searchId: olena.searchId },
    ]);
    expect(await boardOf(bohdan.userId)).toEqual([]);
    expect(
      (await outboxRows(testApp.prisma)).map(({ eventType, payload }) => [eventType, payload]),
    ).toEqual(
      (await testApp.prisma.application.findMany({ orderBy: { id: 'asc' } })).map(({ id }) => [
        'application.created',
        { userId: olena.userId, applicationId: id },
      ]),
    );
  });

  it('writes the stage events of the history with their dates', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    await postImport(olena.accessToken, [{ ...VELA, stage: 'offer' }]);

    expect(
      await testApp.prisma.stageEvent.findMany({
        where: { application: { userId: olena.userId } },
        orderBy: { id: 'asc' },
        select: { fromStage: true, toStage: true, occurredAt: true },
      }),
    ).toEqual(
      [
        [null, 'applied'],
        ['applied', 'screening'],
        ['screening', 'offer'],
      ].map(([fromStage, toStage]) => ({
        fromStage,
        toStage,
        occurredAt: new Date(VELA.appliedAt),
      })),
    );
  });

  it('imports a full batch at the row limit with its stage events in one transaction', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const rows = Array.from({ length: IMPORT_LIMITS.rowsMax }, (_, index) => ({
      ...VELA,
      company: `Vela ${String(index)}`,
      stage: 'offer',
    }));

    const response = await postImport(olena.accessToken, rows);

    expect([response.status, response.body]).toEqual([200, { imported: 500, errors: [] }]);
    expect([
      await testApp.prisma.application.count({ where: { userId: olena.userId } }),
      await testApp.prisma.stageEvent.count({ where: { application: { userId: olena.userId } } }),
      (await outboxRows(testApp.prisma, { eventType: 'application.created' })).length,
    ]).toEqual([500, 1500, 500]);
  });

  it('an imported application is linked to the active CV', async () => {
    const bohdan = await signedInWithSearch(testApp.prisma);
    const bohdanVersionId = await createActiveResumeVersion(testApp.prisma, bohdan.userId);
    const olena = await signedInWithSearch(testApp.prisma);
    const olenaVersionId = await createActiveResumeVersion(testApp.prisma, olena.userId);

    await postImport(olena.accessToken, [VELA, { ...VELA, company: 'Ромашка' }]);
    await postImport(bohdan.accessToken, [VELA]);

    expect(await linkedVersionsOf(olena.userId)).toEqual([olenaVersionId, olenaVersionId]);
    expect(await linkedVersionsOf(bohdan.userId)).toEqual([bohdanVersionId]);
  });

  it('a mapped import of a file near the size limit is not refused with 413', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const nextRound = { toStage: 'tech_interview', reasonCode: null, occurredAt: VELA.appliedAt };
    const stageHistory = [
      { ...nextRound, toStage: 'applied' },
      ...Array.from({ length: IMPORT_LIMITS.historyMax - 1 }, () => nextRound),
    ];
    const rows = Array.from({ length: 130 }, () => ({ ...VELA, stageHistory }));
    const bodyBytes = new TextEncoder().encode(JSON.stringify({ rows })).byteLength;

    const response = await postImport(olena.accessToken, rows);

    expect([bodyBytes > 1024 * 1024, bodyBytes < IMPORT_LIMITS.bodyMaxBytes]).toEqual([true, true]);
    expect([response.status, response.body]).toEqual([200, { imported: 130, errors: [] }]);
  });

  it('answers the first result again to a repeated Idempotency-Key and imports once', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    await expectReplayedCreate({
      app: testApp.app,
      call: {
        method: 'post',
        path: APPLICATIONS_IMPORT_PATH,
        accessToken: olena.accessToken,
        body: { rows: [VELA] },
      },
      countRows: async () => [
        await testApp.prisma.application.count({ where: { userId: olena.userId } }),
        (await outboxRows(testApp.prisma, { eventType: 'application.created' })).length,
      ],
      status: 200,
    });
  });

  it('answers 409 without an active search and imports nothing', async () => {
    const olena = await signedInWithSearch(testApp.prisma, { status: 'archived' });

    const response = await postImport(olena.accessToken, [VELA]);

    expect(statusAndType(response)).toEqual([409, 'conflict']);
    expect(await boardOf(olena.userId)).toEqual([]);
  });

  it('answers 422 to an empty batch', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    expect(statusAndType(await postImport(olena.accessToken, []))).toEqual([
      422,
      'validation_error',
    ]);
  });

  it('answers 401 without a token', async () => {
    expect((await postImport(undefined, [VELA])).status).toBe(401);
  });
});
