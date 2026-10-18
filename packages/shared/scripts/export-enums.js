import { writeFileSync } from 'node:fs';

import {
  ALLOWED_TRANSITIONS,
  REJECTION_REASONS,
  REJECTION_SIDES,
  SOURCES,
  STAGES,
  TERMINAL_STAGES,
  THRESHOLDS,
  WORK_MODES,
} from '../dist/index.js';

const rejectionReasons = Object.entries(REJECTION_REASONS)
  .map(([code, reason]) => ({ code, ...reason }))
  .sort((left, right) => left.sortOrder - right.sortOrder);

const enums = {
  stages: STAGES,
  terminalStages: TERMINAL_STAGES,
  allowedTransitions: ALLOWED_TRANSITIONS,
  sources: SOURCES,
  workModes: WORK_MODES,
  rejectionSides: REJECTION_SIDES,
  rejectionReasons,
  thresholds: THRESHOLDS,
};

writeFileSync(
  new URL('../dist/enums.json', import.meta.url),
  `${JSON.stringify(enums, null, 2)}\n`,
);
