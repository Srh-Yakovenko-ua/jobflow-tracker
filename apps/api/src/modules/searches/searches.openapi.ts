import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  ACTIVE_STAGES,
  DEFAULT_SEARCH_TITLE,
  type FinishSearchInput,
  finishSearchInputSchema,
  finishSearchResponseSchema,
  searchListResponseSchema,
  type SearchSummary,
} from '@jobflow/shared';

import {
  errorResponses,
  EXAMPLE_EDITED_AT,
  EXAMPLE_SEARCH_ID,
  jsonContent,
} from '../../openapi/route.js';

const SEARCHES_PATH = '/searches';

const TAGS = ['searches'];

const FINISHED = {
  id: EXAMPLE_SEARCH_ID,
  title: DEFAULT_SEARCH_TITLE,
  status: 'archived',
  outcome: 'offer_accepted',
  startedAt: '2026-09-13T07:40:00.000Z',
  finishedAt: EXAMPLE_EDITED_AT,
  days: 41,
  applications: 54,
  interviews: 9,
  offers: 1,
  daysToOffer: 38,
} satisfies SearchSummary;

const CURRENT = {
  id: '0199f2c0-4d5e-7f60-8a71-9b0c1d2e3f4a',
  title: DEFAULT_SEARCH_TITLE,
  status: 'active',
  outcome: null,
  startedAt: EXAMPLE_EDITED_AT,
  finishedAt: null,
  days: 0,
  applications: 0,
  interviews: 0,
  offers: 0,
  daysToOffer: null,
} satisfies SearchSummary;

const FINISH = {
  searchId: EXAMPLE_SEARCH_ID,
  outcome: 'offer_accepted',
  openApplications: 'withdraw',
} satisfies FinishSearchInput;

const TOTALS =
  'applications counts the applications now in the search, leaving out drafts and deleted ones; interviews counts the stage events into tech_interview or final since the search started, each round once; offers counts the applications that reached offer; days runs from the start to the finish, or to today for the active search; daysToOffer runs from the start to the first offer, or is null. Undone moves are left out.';

const HANDED_OVER_STAGES = ACTIVE_STAGES.join(', ');

export const SEARCHES_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: SEARCHES_PATH,
    tags: TAGS,
    summary: 'List the job searches of the signed-in user with their totals',
    description: `Every search, newest first, in one list without pages. ${TOTALS}`,
    responses: {
      200: {
        description: 'The searches',
        content: jsonContent(searchListResponseSchema, { items: [CURRENT, FINISHED] }),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'post',
    path: `${SEARCHES_PATH}/current/finish`,
    tags: TAGS,
    summary: 'Finish the active search and start a new one',
    description: `Archives the active search named by searchId with its outcome and starts a new active search titled ${DEFAULT_SEARCH_TITLE}, in one transaction, so the board starts empty. openApplications decides the applications still in ${HANDED_OVER_STAGES}: move takes them with their whole history into the new search (one application.updated each), withdraw closes each with a withdrawn stage event (one application.stage_changed each). Offers and closed applications stay in the finished search, which stays readable by its searchId. Without an active search, or with the user's own already finished searchId, the answer is 409; another user's or a missing searchId answers 404.`,
    request: {
      body: {
        required: true,
        description:
          'The search being finished, its outcome and the choice for its open applications.',
        content: jsonContent(finishSearchInputSchema, FINISH),
      },
    },
    responses: {
      200: {
        description: 'The finished search and the new active search with their totals',
        content: jsonContent(finishSearchResponseSchema, { finished: FINISHED, current: CURRENT }),
      },
      ...errorResponses([400, 401, 403, 404, 409, 422]),
    },
  },
];
