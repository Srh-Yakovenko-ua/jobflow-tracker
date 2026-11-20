export { MatchModule, MatchTriggerModule, MatchWorkerModule } from './match.module.js';
export { MATCH_OPENAPI_PATHS } from './match.openapi.js';
export type {
  LatestMatchJob,
  LatestMatchRow,
  LinkedVersion,
  MatchScoreWrite,
  MatchSource,
} from './match.repository.js';
export { MatchService } from './match.service.js';
export { MatchSubscriber } from './match.subscriber.js';
export { MatchQueueService } from './match-queue.service.js';
export { scoreMatch } from './match-score.js';
export { MatchTriggerProcessor } from './match-trigger.processor.js';
export { MatchTriggerService } from './match-trigger.service.js';
export { MatchTriggerSubscriber } from './match-trigger.subscriber.js';
