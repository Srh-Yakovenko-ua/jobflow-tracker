import { errorResponseSchema, jobStatusSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from '../../test/app.js';
import { accessTokenFor } from '../../test/auth.js';
import { createAiJob, createOwnedApplication, type NewAiJob } from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import { MISSING_ID } from '../../test/service-fixtures.js';
import { minutesBefore } from '../../test/time.js';

const pathOf = (id: string) => `/api/v1/jobs/${id}`;

describe('GET /jobs/:id', () => {
  const testApp = useTestApp();

  async function ownerWithJob(job: Pick<NewAiJob, 'status'> & Partial<NewAiJob>) {
    const { userId, applicationId } = await createOwnedApplication(testApp.prisma);
    const id = await createAiJob(testApp.prisma, { userId, applicationId, ...job });
    return { id, applicationId, accessToken: await accessTokenFor({ id: userId }) };
  }

  const statusOf = (id: string, accessToken?: string) =>
    callRoute(testApp.app, { method: 'get', path: pathOf(id), accessToken });

  it('answers the owner a queued job at step 1 of 3 with the two jobs ahead of it and the estimate', async () => {
    const { userId, applicationId: theirs } = await createOwnedApplication(testApp.prisma);
    for (const minutes of [10, 5]) {
      await createAiJob(testApp.prisma, {
        userId,
        applicationId: theirs,
        status: 'queued',
        createdAt: minutesBefore(minutes),
      });
    }
    const { id, applicationId, accessToken } = await ownerWithJob({ status: 'queued', step: 1 });

    const response = await statusOf(id, accessToken);

    expect(response.status).toBe(200);
    expect(jobStatusSchema.parse(response.body)).toEqual({
      id,
      kind: 'vacancy_parse',
      status: 'queued',
      step: 1,
      totalSteps: 3,
      queue: { ahead: 2, etaSeconds: 20 },
      errorType: null,
      applicationId,
    });
  });

  it('answers a failed job with budget_exceeded at the step it reached and no queue', async () => {
    const failed = { status: 'failed', step: 2, errorType: 'budget_exceeded' } as const;
    const { id, accessToken } = await ownerWithJob(failed);

    const response = await statusOf(id, accessToken);

    expect(jobStatusSchema.parse(response.body)).toMatchObject({ ...failed, queue: null });
  });

  it("answers 404 for another user's job and for a job that does not exist", async () => {
    const olena = await ownerWithJob({ status: 'processing', step: 2 });
    const bohdan = await ownerWithJob({ status: 'processing', step: 2 });

    const responses = [
      await statusOf(olena.id, olena.accessToken),
      await statusOf(olena.id, bohdan.accessToken),
      await statusOf(MISSING_ID, olena.accessToken),
    ];

    expect(responses.map(({ status }) => status)).toEqual([200, 404, 404]);
    expect(errorResponseSchema.parse(responses[1]?.body).type).toBe('not_found');
  });

  it('answers 422 for a job id that is not a uuid', async () => {
    const { accessToken } = await ownerWithJob({ status: 'queued', step: 1 });

    const response = await statusOf('not-a-uuid', accessToken);

    expect([response.status, errorResponseSchema.parse(response.body).type]).toEqual([
      422,
      'validation_error',
    ]);
  });

  it('answers 401 without an access token', async () => {
    const { id } = await ownerWithJob({ status: 'queued', step: 1 });

    const response = await statusOf(id);

    expect(errorResponseSchema.parse(response.body).status).toBe(401);
  });
});
