import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  INTERVIEW_STAGES,
  RHYTHM_LIMITS,
  rhythmQuerySchema,
  type RhythmResponse,
  rhythmResponseSchema,
} from '@jobflow/shared';

import { errorResponses, jsonContent } from '../../openapi/route.js';

const RHYTHM = {
  goal: { applications: 5, followups: 2 },
  suggestedGoal: 8,
  pausedFrom: null,
  pausedUntil: null,
  weeks: [
    {
      weekStart: '2026-11-02',
      applications: 3,
      followups: 1,
      interviews: 1,
      offers: 0,
      status: 'in_rhythm',
    },
    {
      weekStart: '2026-11-09',
      applications: 6,
      followups: 2,
      interviews: 0,
      offers: 0,
      status: 'in_rhythm',
    },
    {
      weekStart: '2026-11-16',
      applications: 1,
      followups: 0,
      interviews: 0,
      offers: 0,
      status: 'in_progress',
    },
  ],
  streak: 2,
  bestWeek: { weekStart: '2026-11-09', applications: 6 },
} satisfies RhythmResponse;

const COUNTS = `applications counts the first stage events of the applications, leaving out drafts and deleted ones; followups counts the followup_sent timeline rows; interviews counts the moves into ${INTERVIEW_STAGES.join(' or ')} and offers the moves into offer, undone moves left out`;

const STATUSES =
  'no_goal while weeklyGoalApplications is null; paused for a week that overlaps pausedFrom..pausedUntil; in_rhythm at the goal (and the follow up goal when set), or with any interview or offer that week; in_progress for the current week below the goal; next_week otherwise';

export const RHYTHM_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/rhythm',
    tags: ['rhythm'],
    summary: 'Read the weekly rhythm',
    description: `The last weeks (default ${String(RHYTHM_LIMITS.defaultWeeks)}, at most ${String(RHYTHM_LIMITS.maxWeeks)}) as ISO weeks in the user time zone, oldest first, the current week last, across every search of the signed-in user. ${COUNTS}. Status: ${STATUSES}. streak counts the weeks in rhythm back from the newest inside the window, skipping paused weeks and the current week while in progress. bestWeek is the week with the most applications, the newest on a tie, or null when there were none. suggestedGoal is the weekly number the worker computed from the forecast on Monday, or null. Read only.`,
    request: { query: rhythmQuerySchema },
    responses: {
      200: {
        description: 'The weeks, the goal, the streak and the best week',
        content: jsonContent(rhythmResponseSchema, RHYTHM),
      },
      ...errorResponses([401, 403, 422]),
    },
  },
];
