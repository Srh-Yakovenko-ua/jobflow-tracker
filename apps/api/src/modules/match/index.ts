export { MatchModule, MatchWorkerModule } from './match.module.js';
export { MATCH_OPENAPI_PATHS } from './match.openapi.js';
export type {
  LatestMatchRow,
  LinkedVersion,
  MatchScoreWrite,
  MatchSource,
} from './match.repository.js';
export { MatchSubscriber } from './match.subscriber.js';
export { MatchQueueService, type MatchRequest } from './match-queue.service.js';
export { scoreMatch } from './match-score.js';
