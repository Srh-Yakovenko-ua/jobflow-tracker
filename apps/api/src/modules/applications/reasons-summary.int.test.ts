import type { MoveApplicationInput, RejectionReasonCode } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import {
  applicationPath,
  createApplication,
  getWithQuery,
  postStageMove,
  REASONS_SUMMARY_PATH,
  ROMASHKA,
  type SignedInSearcher,
  signedInWithSearch,
  undoLastMove,
  useStageMoveTestApp,
} from '../../test/applications.js';
import { createApplicationRows, createSearch, createStageEvents } from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import { TO_SCREENING } from '../../test/service-fixtures.js';
import { daysBefore, NOW, settableClock } from '../../test/time.js';

type MovedApplication = { accessToken: string; moves: MoveApplicationInput[] };

const clock = settableClock(NOW);

const TO_TECH_INTERVIEW: MoveApplicationInput = { fromStage: 'applied', toStage: 'tech_interview' };

const rejectedAfterTechInterview = (reasonCode: RejectionReasonCode): MoveApplicationInput[] => [
  TO_TECH_INTERVIEW,
  { fromStage: 'tech_interview', toStage: 'rejected', reasonCode },
];

describe('the rejection reasons summary route', () => {
  const testApp = useStageMoveTestApp(clock);

  async function movedThrough({ accessToken, moves }: MovedApplication): Promise<string> {
    clock.at(daysBefore(moves.length));
    const { id } = await createApplication(testApp.app, { accessToken, input: ROMASHKA });
    for (const [index, input] of moves.entries()) {
      clock.at(daysBefore(moves.length - 1 - index));
      expect((await postStageMove(testApp.app, { accessToken, id, input })).status).toBe(201);
    }
    return id;
  }

  const rejectedBy = ({ accessToken }: SignedInSearcher, reasonCode: RejectionReasonCode) =>
    movedThrough({ accessToken, moves: rejectedAfterTechInterview(reasonCode) });

  async function rejectedInArchivedSearch(userId: string): Promise<void> {
    const searchId = await createSearch(testApp.prisma, { userId, status: 'archived' });
    const [applicationId = ''] = await createApplicationRows(testApp.prisma, {
      userId,
      searchId,
      rows: [{ currentStage: 'rejected', lastEventAt: NOW }],
    });
    await createStageEvents(testApp.prisma, [
      { applicationId, fromStage: 'tech_interview', toStage: 'rejected', reasonCode: 'skills_gap' },
    ]);
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

  const summaryAt = (accessToken: string) =>
    getWithQuery(testApp.app, {
      path: REASONS_SUMMARY_PATH,
      accessToken,
      query: { stage: 'tech_interview' },
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
});
