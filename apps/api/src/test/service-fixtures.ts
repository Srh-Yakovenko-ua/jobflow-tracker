import type { ApplicationResponse, MoveApplicationInput } from '@jobflow/shared';

import type {
  ApplicationRow,
  EffectiveStageEvent,
  StageEventPlan,
  StageState,
} from '../modules/applications/index.js';
import { daysBefore, NOW, UNDO_WINDOW_END } from './time.js';

export const OLENA_ID = '0199f0a0-0000-7000-8000-000000000001';
export const BOHDAN_ID = '0199f0a0-0000-7000-8000-000000000002';
export const SEARCH_ID = '0199f0a0-0000-7000-8000-0000000000a1';
export const RESUME_VERSION_ID = '0199f0a0-0000-7000-8000-0000000000b1';
export const APPLICATION_ID = '0199f0a0-0000-7000-8000-0000000000c1';
export const MISSING_ID = '0199f0a0-0000-7000-8000-0000000000c2';
export const CREATION_EVENT_ID = '0199f0a0-0000-7000-8000-0000000000d0';
export const MOVE_EVENT_ID = '0199f0a0-0000-7000-8000-0000000000d1';
export const NOTE_ID = '0199f0a0-0000-7000-8000-0000000000e1';

export type Target = { userId: string; id: string };

export const MISSING_TARGETS = [
  { case: 'a missing id', userId: OLENA_ID, id: MISSING_ID },
  { case: "another user's application", userId: BOHDAN_ID, id: APPLICATION_ID },
];

export const APPLICATION_NOT_FOUND = {
  body: { status: 404, type: 'not_found', detail: 'Application not found' },
};

export const CREATION_EVENT: EffectiveStageEvent = {
  id: CREATION_EVENT_ID,
  fromStage: null,
  toStage: 'applied',
  occurredAt: daysBefore(3),
  createdAt: daysBefore(3),
};

export const APPLIED_STATE: StageState = {
  currentStage: 'applied',
  stageEvents: [CREATION_EVENT],
  user: { settings: { askRejectionReason: true } },
};

export const MOVE_TO_SCREENING_EVENT: EffectiveStageEvent = {
  id: MOVE_EVENT_ID,
  fromStage: 'applied',
  toStage: 'screening',
  occurredAt: NOW,
  createdAt: NOW,
};

export const MOVED_TO_SCREENING_STATE: StageState = {
  ...APPLIED_STATE,
  currentStage: 'screening',
  stageEvents: [MOVE_TO_SCREENING_EVENT, CREATION_EVENT],
};

export const TO_SCREENING: MoveApplicationInput = { fromStage: 'applied', toStage: 'screening' };

export const MOVE_TO_SCREENING_PLAN: StageEventPlan = {
  event: {
    fromStage: 'applied',
    toStage: 'screening',
    reasonCode: null,
    comment: null,
    occurredAt: NOW,
    compensatesEventId: null,
    createdAt: NOW,
  },
  lastEventAt: NOW,
};

export const UNDO_OF_SCREENING_PLAN: StageEventPlan = {
  event: {
    fromStage: 'screening',
    toStage: 'applied',
    reasonCode: null,
    comment: null,
    occurredAt: UNDO_WINDOW_END,
    compensatesEventId: MOVE_EVENT_ID,
    createdAt: UNDO_WINDOW_END,
  },
  lastEventAt: daysBefore(3),
};

export const COLUMNS_AS_STORED = {
  id: APPLICATION_ID,
  searchId: SEARCH_ID,
  company: 'Ромашка',
  position: 'Backend developer',
  url: 'https://jobs.example.test/1',
  source: 'djinni',
  salaryMin: 3000,
  salaryMax: 4000,
  currency: 'USD',
  stack: ['NestJS'],
  location: 'Київ',
  workMode: 'remote',
  currentStage: 'applied',
  isDraft: false,
  resumeVersionId: RESUME_VERSION_ID,
  matchScore: null,
  rawText: null,
} satisfies Partial<ApplicationRow & ApplicationResponse>;

export const APPLICATION_ROW: ApplicationRow = {
  ...COLUMNS_AS_STORED,
  aiParsed: { seniority: 'middle' },
  appliedAt: daysBefore(10),
  lastEventAt: daysBefore(4),
  createdAt: daysBefore(10),
  updatedAt: daysBefore(1),
  stageEvents: [{ occurredAt: daysBefore(10) }],
  user: { settings: { silenceDays: 7 } },
};
