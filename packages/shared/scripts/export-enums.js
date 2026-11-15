import { writeFileSync } from 'node:fs';

import {
  ACTIVE_STAGES,
  ALLOWED_TRANSITIONS,
  ANALYTICS_CACHE,
  INTERVIEW_STAGES,
  isReplyStage,
  NOTE_TOPIC_LABELS,
  NOTE_TOPICS,
  REJECTION_REASONS,
  REJECTION_SIDES,
  RESPONSE_STAGES,
  SALARY_NORMALISATION,
  SENIORITIES,
  SOURCES,
  STAGES,
  TERMINAL_STAGES,
  THRESHOLDS,
  TOKEN_SCOPES,
  WORK_MODES,
} from '../dist/index.js';

const rejectionReasons = Object.entries(REJECTION_REASONS)
  .map(([code, reason]) => ({ code, ...reason }))
  .sort((left, right) => left.sortOrder - right.sortOrder);

const enums = {
  stages: STAGES,
  terminalStages: TERMINAL_STAGES,
  activeStages: ACTIVE_STAGES,
  interviewStages: INTERVIEW_STAGES,
  responseStages: RESPONSE_STAGES,
  replyStages: STAGES.filter(isReplyStage),
  allowedTransitions: ALLOWED_TRANSITIONS,
  sources: SOURCES,
  workModes: WORK_MODES,
  rejectionSides: REJECTION_SIDES,
  rejectionReasons,
  noteTopics: NOTE_TOPICS.map((code) => ({ code, ...NOTE_TOPIC_LABELS[code] })),
  thresholds: THRESHOLDS,
  salary: SALARY_NORMALISATION,
  seniorities: SENIORITIES,
  tokenScopes: TOKEN_SCOPES,
  analyticsCache: ANALYTICS_CACHE,
};

writeFileSync(
  new URL('../dist/enums.json', import.meta.url),
  `${JSON.stringify(enums, null, 2)}\n`,
);
