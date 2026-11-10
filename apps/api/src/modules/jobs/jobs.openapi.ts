import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { AI_JOB_STEPS, type JobStatus, jobStatusSchema, LIVE_EVENTS } from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, EXAMPLE_APPLICATION_ID, jsonContent } from '../../openapi/route.js';

const EXAMPLE_JOB_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1a';

const QUEUED_JOB = {
  id: EXAMPLE_JOB_ID,
  kind: 'vacancy_parse',
  status: 'queued',
  step: AI_JOB_STEPS.queued,
  totalSteps: AI_JOB_STEPS.total,
  queue: { ahead: 2, etaSeconds: 20 },
  errorType: null,
  applicationId: EXAMPLE_APPLICATION_ID,
} satisfies JobStatus;

const { shape } = jobStatusSchema;

const jobParams = z.object({ id: shape.id.meta({ example: EXAMPLE_JOB_ID }) });

const documentedJobStatus = jobStatusSchema.extend({
  id: shape.id.meta({
    description:
      'The ai_jobs row, written by AiRepository.createJob and returned as jobId by the 202 that queued the work.',
  }),
  kind: shape.kind.meta({ description: 'The AI kind, written by AiRepository.createJob.' }),
  status: shape.status.meta({
    description:
      'Written by AiRepository: queued by createJob, processing by startJob, done by finishJob, failed by failJob.',
  }),
  step: shape.step.meta({
    description: `The step reached out of totalSteps, written by AiRepository: ${String(AI_JOB_STEPS.queued)} by createJob, ${String(AI_JOB_STEPS.processing)} by startJob, ${String(AI_JOB_STEPS.done)} by finishJob. A failed job keeps the step it reached. 0 on a job stored before steps were written.`,
  }),
  totalSteps: shape.totalSteps.meta({
    description: 'The number of steps of every job, added by AiJobStatusService.find.',
  }),
  queue: shape.queue.meta({
    description:
      'While the job is queued: the queued jobs created before it and the estimated wait, computed by AiService.queuePosition. Null in every other status.',
  }),
  errorType: shape.errorType.meta({
    description: 'Why the job failed, written by AiRepository.failJob. Null unless failed.',
  }),
  applicationId: shape.applicationId.meta({
    description:
      'The Application the job works on, written by AiRepository.createJob. Null for a job that works on no Application.',
  }),
});

export const JOBS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/jobs/{id}',
    tags: ['jobs'],
    summary: 'The status of a background job of the signed-in user',
    description: `Answers the job a 202 named by jobId. The same fields without queue and totalSteps arrive as ${LIVE_EVENTS.jobUpdated} on GET /events/stream; this route is the fallback the client polls while the stream is down. Another user's job answers 404.`,
    request: { params: jobParams },
    responses: {
      200: {
        description: 'The job and how far it got',
        content: jsonContent(documentedJobStatus, QUEUED_JOB),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
];
