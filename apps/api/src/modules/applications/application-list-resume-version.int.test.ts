import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  columnViewsOf,
  companiesOf,
  EMPTY_BOARD,
  getApplicationBoard,
  listApplications,
  signedInWithSearch,
} from '../../test/applications.js';
import { createApplicationRows, createResumeVersion } from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import { resumeVersionPath } from '../../test/resumes.js';
import { daysBefore, fixedClock, NOW } from '../../test/time.js';

describe('the resumeVersion filter of the application list and board', () => {
  const testApp = useTestApp(() =>
    appTestingModule().overrideProvider(Clock).useValue(fixedClock(NOW)),
  );

  async function olenaWithVersions() {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const v1 = await createResumeVersion(testApp.prisma, olena.userId);
    const v2 = await createResumeVersion(testApp.prisma, olena.userId);
    const bohdanVersion = await createResumeVersion(testApp.prisma, bohdan.userId);
    await createApplicationRows(testApp.prisma, {
      ...olena,
      rows: [
        {
          company: 'Yasen Tech',
          currentStage: 'screening',
          resumeVersionId: v2,
          lastEventAt: daysBefore(1),
        },
        {
          company: 'Smereka Soft',
          currentStage: 'applied',
          resumeVersionId: v2,
          lastEventAt: daysBefore(2),
        },
        {
          company: 'Kavun Labs',
          currentStage: 'applied',
          resumeVersionId: v1,
          lastEventAt: daysBefore(3),
        },
        { company: 'Dub Data', currentStage: 'applied', lastEventAt: daysBefore(4) },
      ],
    });
    await createApplicationRows(testApp.prisma, {
      ...bohdan,
      rows: [{ company: 'Buk Cloud', resumeVersionId: bohdanVersion, lastEventAt: daysBefore(1) }],
    });
    return { olena, bohdan, v1, v2, bohdanVersion };
  }

  async function listAndBoard({
    accessToken,
    resumeVersion,
  }: {
    accessToken: string;
    resumeVersion: string;
  }) {
    const query = { resumeVersion };
    const list = await listApplications(testApp.app, { accessToken, query });
    const board = await getApplicationBoard(testApp.app, { accessToken, query });
    return { companies: companiesOf(list), columns: columnViewsOf(board) };
  }

  it('lists, counts and shows on the board only the applications sent with the picked version', async () => {
    const { olena, v2 } = await olenaWithVersions();

    const filtered = await listAndBoard({ accessToken: olena.accessToken, resumeVersion: v2 });

    expect(filtered).toEqual({
      companies: ['Yasen Tech', 'Smereka Soft'],
      columns: {
        ...EMPTY_BOARD,
        applied: { count: 1, companies: ['Smereka Soft'] },
        screening: { count: 1, companies: ['Yasen Tech'] },
      },
    });
  });

  it('keeps the applications of every version in a comma list', async () => {
    const { olena, v1, v2 } = await olenaWithVersions();

    const filtered = await listAndBoard({
      accessToken: olena.accessToken,
      resumeVersion: `${v1},${v2}`,
    });

    expect(filtered).toEqual({
      companies: ['Yasen Tech', 'Smereka Soft', 'Kavun Labs'],
      columns: {
        ...EMPTY_BOARD,
        applied: { count: 2, companies: ['Smereka Soft', 'Kavun Labs'] },
        screening: { count: 1, companies: ['Yasen Tech'] },
      },
    });
  });

  it("matches nothing for BOHDAN's version in OLENA's query while BOHDAN's own query finds his application", async () => {
    const { olena, bohdan, bohdanVersion } = await olenaWithVersions();

    const foreign = await listAndBoard({
      accessToken: olena.accessToken,
      resumeVersion: bohdanVersion,
    });
    const own = await listAndBoard({
      accessToken: bohdan.accessToken,
      resumeVersion: bohdanVersion,
    });

    expect(foreign).toEqual({ companies: [], columns: EMPTY_BOARD });
    expect(own).toEqual({
      companies: ['Buk Cloud'],
      columns: { ...EMPTY_BOARD, applied: { count: 1, companies: ['Buk Cloud'] } },
    });
  });

  it('still filters by an archived version that applications link to', async () => {
    const { olena, v1 } = await olenaWithVersions();
    const archived = await callRoute(testApp.app, {
      method: 'patch',
      path: resumeVersionPath(v1),
      accessToken: olena.accessToken,
      body: { isArchived: true },
    });

    const filtered = await listAndBoard({ accessToken: olena.accessToken, resumeVersion: v1 });

    expect(archived.status).toBe(200);
    expect(filtered).toEqual({
      companies: ['Kavun Labs'],
      columns: { ...EMPTY_BOARD, applied: { count: 1, companies: ['Kavun Labs'] } },
    });
  });
});
