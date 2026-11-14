import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  captureRetryResponseSchema,
  type SummaryArchive,
  summaryArchiveSchema,
  type SummaryResponse,
  summaryResponseSchema,
  summarySchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, idempotencyHeaders, jsonContent } from '../../openapi/route.js';
import { PLAN_RESPONSE } from '../plans/index.js';

const JOB_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f02';

const SUMMARY = {
  summary: {
    aiJobId: JOB_ID,
    month: '2026-08',
    text: "У серпні ти надіслав 23 відгуки, на 5 більше, ніж у липні. Найдорожчий етап: техінтерв'ю, пройдено 4 з 9.",
    actions: [
      {
        title: "Два тижні алгоритмів перед техінтерв'ю",
        why: "3 з 4 відмов на техінтерв'ю: «не вистачає скілів», а пройшов ти 4 з 9.",
        expectedEffect:
          "Якщо конверсія техінтерв'ю дійде до 60%, прогноз офера: від 4 до 12 тижнів.",
        metric: "Конверсія техінтерв'ю: зараз 44%, ціль 60%",
      },
    ],
    generatedAt: '2026-09-01T05:10:00.000Z',
    planId: null,
  },
  job: { id: JOB_ID, status: 'done' },
} satisfies SummaryResponse;

const summaryParams = z.object({
  aiJobId: summarySchema.shape.aiJobId.meta({ example: JOB_ID }),
});

const ARCHIVE = {
  items: [{ ...SUMMARY.summary, planId: PLAN_RESPONSE.example.id, plan: { items: 4, done: 3 } }],
} satisfies SummaryArchive;

export const SUMMARIES_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/summaries',
    tags: ['summaries'],
    summary: 'Read the archive of monthly summaries',
    description:
      'The summarized months of the signed-in user, newest first, at most 12: for each month the newest done monthly summary made in the last 13 months, with the progress of the plan saved from it (items and done items), or null before that plan is saved. A capped list without a cursor. Read only.',
    responses: {
      200: {
        description: 'The summarized months, newest first',
        content: jsonContent(summaryArchiveSchema, ARCHIVE),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'get',
    path: '/summaries/latest',
    tags: ['summaries'],
    summary: 'Read the latest monthly summary',
    description:
      'The latest done monthly summary of the signed-in user (the month it covers is the calendar month before the local month it was made in, its text, its actions and the id of the plan saved from it), and the latest monthly_summary ai_jobs row whatever its status. summary is null before the first done one, job before the first request. Read only.',
    responses: {
      200: {
        description: 'The latest summary and job, or null',
        content: jsonContent(summaryResponseSchema, SUMMARY),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'post',
    path: '/summaries',
    tags: ['summaries'],
    summary: 'Generate the monthly summary now',
    description:
      'In one transaction under the user lock stores a queued monthly_summary AI job for the month that ended in the user time zone and the summary.requested event; the worker reads the analytics of the active search and calls the model later, skipping the AI result cache. While a monthly_summary job is queued or processing it answers that job and stores nothing. Answers 409 without an active search. Counts against the hourly AI limit.',
    request: { headers: idempotencyHeaders },
    responses: {
      202: {
        description: 'The AI job to follow: the new one, or the one that is still running',
        content: jsonContent(captureRetryResponseSchema, { jobId: JOB_ID }),
      },
      ...errorResponses([401, 403, 409], 'ai'),
    },
  },
  {
    method: 'post',
    path: '/summaries/{aiJobId}/plan',
    tags: ['summaries'],
    summary: 'Save the summary actions as a plan',
    description:
      'Saves the actions of a done monthly summary as the plan of the month the summary was made in, titled «План на <місяць>», one item per action in order. A second request for the same summary answers the plan already saved. A job of another user, an unknown one or one that is not done answers 404.',
    request: { params: summaryParams, headers: idempotencyHeaders },
    responses: {
      201: {
        description: 'The saved plan',
        content: jsonContent(PLAN_RESPONSE.schema, PLAN_RESPONSE.example),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
];
