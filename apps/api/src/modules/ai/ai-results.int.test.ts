import { applicationResponseSchema } from '@jobflow/shared';
import { buildVacancyParseOutput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { AI_RESULTS_PATH } from '../../test/ai.js';
import { useTestApp } from '../../test/app.js';
import { applicationPath, signedInWithSearch } from '../../test/applications.js';
import {
  createAiJob,
  createAiResult,
  createApplicationRows,
  createResume,
  resumeVersionData,
} from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import { listedProfileStatuses } from '../../test/resumes.js';
import { minutesBefore, NOW } from '../../test/time.js';

const EARLIER = minutesBefore(60);

const AI_PROFILE = { skills: ['TypeScript', 'NestJS'], seniority: 'senior' };

type AiDataOwner = {
  userId: string;
  accessToken: string;
  scoredId: string;
  plainId: string;
  aiJobId: string;
  resumeVersionId: string;
};

describe('DELETE /ai-results', () => {
  const testApp = useTestApp();

  async function ownerOfAiData(): Promise<AiDataOwner> {
    const { prisma } = testApp;
    const { userId, searchId, accessToken } = await signedInWithSearch(prisma);
    const [scoredId = '', plainId = ''] = await createApplicationRows(prisma, {
      userId,
      searchId,
      rows: [
        {
          lastEventAt: NOW,
          updatedAt: EARLIER,
          matchScore: 80,
          aiParsed: buildVacancyParseOutput(),
        },
        { lastEventAt: NOW, updatedAt: EARLIER },
      ],
    });
    const resumeId = await createResume(prisma, userId);
    const { id: resumeVersionId } = await prisma.resumeVersion.create({
      data: { ...resumeVersionData({ userId, resumeId }), aiProfile: AI_PROFILE },
    });
    const aiResultId = await createAiResult(prisma, { userId });
    await createAiResult(prisma, { userId, kind: 'match' });
    const aiJobId = await createAiJob(prisma, {
      userId,
      applicationId: scoredId,
      status: 'done',
      aiResultId,
    });
    return { userId, accessToken, scoredId, plainId, aiJobId, resumeVersionId };
  }

  async function aiDataOf(userId: string) {
    const { aiResult, application, resumeVersion, aiJob } = testApp.prisma;
    const where = { userId };
    const orderBy = { id: 'asc' } as const;
    const [results, applications, resumeVersions, jobs] = await Promise.all([
      aiResult.findMany({ where, orderBy, select: { id: true, kind: true } }),
      application.findMany({
        where,
        orderBy,
        select: { id: true, matchScore: true, aiParsed: true, updatedAt: true },
      }),
      resumeVersion.findMany({ where, select: { aiProfile: true } }),
      aiJob.findMany({ where, select: { id: true, aiResultId: true } }),
    ]);
    return { results, applications, resumeVersions, jobs };
  }

  const deleteAiResults = (accessToken?: string) =>
    callRoute(testApp.app, { method: 'delete', path: AI_RESULTS_PATH, accessToken });

  it("answers 204, deletes the user's AI results, clears the scores, parses and profiles and keeps the AI jobs", async () => {
    const olena = await ownerOfAiData();

    const response = await deleteAiResults(olena.accessToken);

    expect([response.status, response.text]).toEqual([204, '']);
    expect(await aiDataOf(olena.userId)).toMatchObject({
      results: [],
      applications: [
        { id: olena.scoredId, matchScore: null, aiParsed: null },
        { id: olena.plainId, matchScore: null, aiParsed: null, updatedAt: EARLIER },
      ],
      resumeVersions: [{ aiProfile: null }],
      jobs: [{ id: olena.aiJobId, aiResultId: null }],
    });
  });

  it('shows the application with a dashed score after the delete', async () => {
    const olena = await ownerOfAiData();
    await deleteAiResults(olena.accessToken);

    const response = await callRoute(testApp.app, {
      method: 'get',
      path: applicationPath(olena.scoredId),
      accessToken: olena.accessToken,
    });

    expect(applicationResponseSchema.parse(response.body)).toMatchObject({
      matchScore: null,
      aiParsed: null,
    });
  });

  it('lists a profiled resume version as done before the delete and failed after it', async () => {
    const olena = await ownerOfAiData();
    await createAiJob(testApp.prisma, {
      userId: olena.userId,
      kind: 'resume_parse',
      resumeVersionId: olena.resumeVersionId,
      status: 'done',
    });

    const before = await listedProfileStatuses(testApp.app, olena);
    await deleteAiResults(olena.accessToken);

    expect([before, await listedProfileStatuses(testApp.app, olena)]).toEqual([
      ['done'],
      ['failed'],
    ]);
  });

  it('leaves every AI row of another user untouched', async () => {
    const olena = await ownerOfAiData();
    const bohdan = await ownerOfAiData();
    const before = await aiDataOf(bohdan.userId);

    await deleteAiResults(olena.accessToken);

    expect(before.results).toHaveLength(2);
    expect(await aiDataOf(bohdan.userId)).toEqual(before);
  });

  it('answers 401 without a token and deletes nothing', async () => {
    const olena = await ownerOfAiData();
    const before = await aiDataOf(olena.userId);

    const response = await deleteAiResults();

    expect(response.status).toBe(401);
    expect(await aiDataOf(olena.userId)).toEqual(before);
  });
});
