export { MatchModule, MatchTriggerModule, MatchWorkerModule } from './match.module.js';
export { MATCH_OPENAPI_PATHS } from './match.openapi.js';
export type {
  LatestMatchJob,
  LatestMatchRow,
  LinkedVersion,
  MatchScoreWrite,
  MatchSource,
} from './match.repository.js';
export { MatchSubscriber } from './match.subscriber.js';
export { MatchQueueService, type MatchRequest } from './match-queue.service.js';
export { scoreMatch } from './match-score.js';
export { MatchTriggerProcessor } from './match-trigger.processor.js';
export {
  MATCH_JOBS,
  MATCH_LIMITS,
  type MatchTriggerJob,
  MatchTriggerService,
} from './match-trigger.service.js';
export { MatchTriggerSubscriber } from './match-trigger.subscriber.js';
