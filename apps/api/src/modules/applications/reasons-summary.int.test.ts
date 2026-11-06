import type { MoveApplicationInput, RejectionReasonCode } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import {
  applicationPath,
  createMovedApplication,
  getWithQuery,
  type QueryString,
  REASONS_SUMMARY_PATH,
  type SignedInSearcher,
  signedInWithSearch,
  undoLastMove,
  useStageMoveTestApp,
} from '../../test/applications.js';
import { createApplicationRows, createSearch, createStageEvents } from '../../test/factories.js';
import { callRoute, statusAndDetail } from '../../test/http.js';
import { TO_SCREENING, TO_TECH_INTERVIEW } from '../../test/service-fixtures.js';
import { NOW, settableClock } from '../../test/time.js';

type MovedApplication = { accessToken: string; moves: MoveApplicationInput[] };

const clock = settableClock(NOW);

const rejectedAfterTechInterview = (reasonCode: RejectionReasonCode): MoveApplicationInput[] => [
  TO_TECH_INTERVIEW,
  { fromStage: 'tech_interview', toStage: 'rejected', reasonCode },
];

describe('the rejection reasons summary route', () => {
  const testApp = useStageMoveTestApp(clock);

  const movedThrough = (moved: MovedApplication) =>
    createMovedApplication(testApp.app, { ...moved, clock });

  const rejectedBy = ({ accessToken }: SignedInSearcher, reasonCode: RejectionReasonCode) =>
    movedThrough({ accessToken, moves: rejectedAfterTechInterview(reasonCode) });

  async function rejectedInArchivedSearch(userId: string): Promise<string> {
    const searchId = await createSearch(testApp.prisma, { userId, status: 'archived' });
    const [applicationId = ''] = await createApplicationRows(testApp.prisma, {
      userId,
      searchId,
      rows: [{ currentStage: 'rejected', lastEventAt: NOW }],
    });
    await createStageEvents(testApp.prisma, [
      { applicationId, fromStage: 'tech_interview', toStage: 'rejected', reasonCode: 'skills_gap' },
    ]);
    return searchId;
  }

  async function olenaWithNoise(olena: SignedInSearcher): Promise<void> {
    const { accessToken } = olena;
    await movedThrough({
      accessToken,
      moves: [
        TO_SCREENING,
        { fromStage: 'screening', toStage: 'rejected', reasonCode: 'skills_gap' },
      ],
    });
    await movedThrough({
      accessToken,
      moves: [
        TO_TECH_INTERVIEW,
        { fromStage: 'tech_interview', toStage: 'ghosted', reasonCode: 'skills_gap' },
      ],
    });
    const undoneId = await rejectedBy(olena, 'skills_gap');
    expect((await undoLastMove(testApp.app, { accessToken, id: undoneId })).status).toBe(201);
    const deletedId = await rejectedBy(olena, 'skills_gap');
    const deleted = await callRoute(testApp.app, {
      method: 'delete',
      path: applicationPath(deletedId),
      accessToken,
    });
    expect(deleted.status).toBe(204);
    await rejectedInArchivedSearch(olena.userId);
  }

  const summaryAt = (accessToken: string, query: QueryString = {}) =>
    getWithQuery(testApp.app, {
      path: REASONS_SUMMARY_PATH,
      accessToken,
      query: { stage: 'tech_interview', ...query },
    });

  it("counts only OLENA's effective rejections from tech_interview in her active search, and BOHDAN only his own", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    await rejectedBy(olena, 'skills_gap');
    await rejectedBy(olena, 'chose_other');
    await rejectedBy(olena, 'skills_gap');
    await olenaWithNoise(olena);
    await rejectedBy(bohdan, 'skills_gap');

    const olenas = await summaryAt(olena.accessToken);
    const bohdans = await summaryAt(bohdan.accessToken);

    expect([olenas.status, olenas.body]).toEqual([
      200,
      {
        stage: 'tech_interview',
        total: 3,
        reasons: [
          { code: 'skills_gap', count: 2 },
          { code: 'chose_other', count: 1 },
        ],
      },
    ]);
    expect([bohdans.status, bohdans.body]).toEqual([
      200,
      { stage: 'tech_interview', total: 1, reasons: [{ code: 'skills_gap', count: 1 }] },
    ]);
  });

  it("reads OLENA's archived search by its searchId, and answers BOHDAN's searchId with 404", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const archivedId = await rejectedInArchivedSearch(olena.userId);
    await rejectedBy(olena, 'chose_other');
    await rejectedBy(bohdan, 'skills_gap');

    const archived = await summaryAt(olena.accessToken, { searchId: archivedId });
    const foreign = await summaryAt(olena.accessToken, { searchId: bohdan.searchId });

    expect([archived.status, archived.body]).toEqual([
      200,
      { stage: 'tech_interview', total: 1, reasons: [{ code: 'skills_gap', count: 1 }] },
    ]);
    expect(statusAndDetail(foreign)).toEqual([404, 'Search not found']);
  });
});
