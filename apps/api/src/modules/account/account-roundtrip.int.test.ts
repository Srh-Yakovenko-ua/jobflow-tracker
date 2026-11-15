import {
  autoMappingOf,
  importApplicationsResponseSchema,
  importCandidateOf,
  type MoveApplicationInput,
  parseCsv,
} from '@jobflow/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { EFFECTIVE_STAGE_EVENTS } from '../../prisma/effective-stage-events.js';
import { FileStorage } from '../../storage/file-storage.js';
import { exportedThroughWorker, zipFilesOf } from '../../test/account.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  APPLICATIONS_IMPORT_PATH,
  createApplication,
  createMovedApplication,
  signedInWithSearch,
} from '../../test/applications.js';
import { seedRejectionReasons } from '../../test/factories.js';
import { FakeFileStorage } from '../../test/file-storage.js';
import { callRoute } from '../../test/http.js';
import { TO_SCREENING } from '../../test/service-fixtures.js';
import { daysBefore, NOW, settableClock } from '../../test/time.js';

const REJECTED_AFTER_SCREENING: readonly MoveApplicationInput[] = [
  TO_SCREENING,
  { fromStage: 'screening', toStage: 'rejected', reasonCode: 'skills_gap' },
];

const GHOSTED_AND_REVIVED: readonly MoveApplicationInput[] = [
  TO_SCREENING,
  { fromStage: 'screening', toStage: 'ghosted' },
  { fromStage: 'ghosted', toStage: 'screening' },
];

describe('an export imported into a fresh account', () => {
  const clock = settableClock(NOW);
  const storage = new FakeFileStorage();
  const testApp = useTestApp(() =>
    appTestingModule()
      .overrideProvider(Clock)
      .useValue(clock)
      .overrideProvider(FileStorage)
      .useValue(storage),
  );
  beforeAll(() => seedRejectionReasons(testApp.prisma));
  beforeEach(() => {
    clock.at(NOW);
  });

  const boardOf = (userId: string) =>
    testApp.prisma.application.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      select: {
        company: true,
        position: true,
        currentStage: true,
        source: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        url: true,
        stageEvents: {
          ...EFFECTIVE_STAGE_EVENTS,
          select: { toStage: true, reasonCode: true, occurredAt: true },
        },
      },
    });

  async function exportedApplicationsCsv(userId: string, accessToken: string): Promise<string> {
    await exportedThroughWorker(testApp, { accessToken, format: 'csv' });
    const [key] = storage.keysUnder(`users/${userId}/exports/`);
    const zip = storage.objects.get(key ?? '');
    return zipFilesOf(zip?.bytes ?? new Uint8Array())['applications.csv'] ?? '';
  }

  it('gives the same board and the same effective stage events, a rejection after screening and a ghosted revive included', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const { accessToken } = olena;
    clock.at(daysBefore(12));
    await createApplication(testApp.app, {
      accessToken,
      input: {
        company: 'Vela',
        position: 'Frontend Engineer',
        source: 'djinni',
        salaryMin: 1500,
        salaryMax: 2500,
        currency: 'USD',
        url: 'https://djinni.co/jobs/42',
      },
    });
    await createMovedApplication(testApp.app, {
      clock,
      accessToken,
      moves: REJECTED_AFTER_SCREENING,
    });
    await createMovedApplication(testApp.app, { clock, accessToken, moves: GHOSTED_AND_REVIVED });

    const [header = [], ...rows] = parseCsv(
      await exportedApplicationsCsv(olena.userId, accessToken),
    );
    const mapping = autoMappingOf(header);
    const response = await callRoute(testApp.app, {
      method: 'post',
      path: APPLICATIONS_IMPORT_PATH,
      accessToken: bohdan.accessToken,
      body: {
        rows: rows.map((cells) => importCandidateOf(cells, { mapping, timeZone: 'Europe/Kyiv' })),
      },
    });

    expect([response.status, importApplicationsResponseSchema.parse(response.body)]).toEqual([
      200,
      { imported: 3, errors: [] },
    ]);
    const original = await boardOf(olena.userId);
    expect(original.map(({ currentStage }) => currentStage)).toEqual([
      'applied',
      'rejected',
      'screening',
    ]);
    expect(await boardOf(bohdan.userId)).toEqual(original);
  });
});
