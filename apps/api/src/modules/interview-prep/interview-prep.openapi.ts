import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  INTERVIEW_PREP_LIMITS,
  type InterviewPrepResponse,
  interviewPrepResponseSchema,
} from '@jobflow/shared';

import {
  aiJobAcceptedResponses,
  applicationIdParams,
  errorResponses,
  idempotencyHeaders,
  jsonContent,
} from '../../openapi/route.js';

const JOB_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f4d';

const TOPICS = [
  ['React + TypeScript', 'Основний стек вакансії, його перевіряють першим.', 'React + TypeScript'],
  ['Алгоритми', "Три відмови на техінтерв'ю через скіли.", 'algorithms'],
  ['Live coding', 'Повторюється у твоїх слабких місцях.', 'live_coding'],
  ['AWS', 'Вакансія просить AWS, а в CV його немає.', 'AWS / інфраструктура'],
  ['GraphQL', 'Вимога вакансії, у CV покрита частково.', 'GraphQL'],
] as const;

const INTERVIEW_PREP = {
  result: {
    topics: TOPICS.map(([name, why, basis]) => ({ name, why, basis })),
    questions: Array.from({ length: INTERVIEW_PREP_LIMITS.questions }, (_, index) => ({
      question: `Питання ${String(index + 1)}: як ти розв'язав би задачу на React з обмеженим часом?`,
      hint: 'Почни з обмежень задачі і назви складність рішення.',
    })),
    askCompany: [
      'Як виглядає перший місяць у команді?',
      'Хто рев’юїть код і як швидко?',
      'Яка частка часу йде на підтримку?',
    ],
    plan30: [{ minutes: 30, task: 'Пройди дві задачі на масиви вголос.' }],
    plan120: [
      { minutes: 60, task: 'Розв’яжи три задачі на алгоритми з таймером.' },
      { minutes: 60, task: 'Зроби маленький GraphQL-запит у пет-проєкті.' },
    ],
    generatedAt: '2026-10-22T09:05:00.000Z',
  },
  job: { id: JOB_ID, status: 'done', errorType: null },
} satisfies InterviewPrepResponse;

export const INTERVIEW_PREP_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/applications/{id}/interview-prep',
    tags: ['applications'],
    summary: 'Read the interview prep pack of an Application',
    description:
      'The latest interview_prep ai_jobs row of the Application, whatever its status, and its pack once it is done: likely topics ranked by probability, each with why and the input item it rests on (basis), practice questions with short hints, questions to ask the company, and a 30 minute and a 2 hour plan. Both are null before the first request. Read only.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The latest pack and its job, or null',
        content: jsonContent(interviewPrepResponseSchema, INTERVIEW_PREP),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
  {
    method: 'post',
    path: '/applications/{id}/interview-prep',
    tags: ['applications'],
    summary: 'Generate an interview prep pack',
    description: `Builds the vacancy part of the input from the position, the parsed vacancy requirements and the stack (at most ${String(INTERVIEW_PREP_LIMITS.requirementsMax)}, no raw vacancy text), the Match Score gaps (missing and partial requirements, none without a score) and the kind of the earliest planned interview, then in one transaction stores a queued interview_prep AI job and the application.interview_prep_requested event. The worker adds the weak spots, reason codes and topic codes only, from analytics, and calls the model later; when analytics is down the pack is built without them. No note text is sent. While an interview_prep job of the Application is queued or processing it answers that job and stores nothing. The same input again is served from the AI result cache. Answers 409 when the Application has no planned interview ahead, or neither requirements nor gaps. Counts against the hourly AI limit.`,
    request: { params: applicationIdParams, headers: idempotencyHeaders },
    responses: aiJobAcceptedResponses(JOB_ID),
  },
];
