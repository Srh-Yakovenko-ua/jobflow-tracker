export { FOLLOWUP_EVENTS, type FollowupRequestedPayload } from './followups.events.js';
export { FollowupsModule, FollowupsWorkerModule } from './followups.module.js';
export { FOLLOWUPS_OPENAPI_PATHS } from './followups.openapi.js';
export type {
  FollowupSourceQuery,
  FollowupSourceRow,
  LatestFollowupDraft,
  LatestFollowupJob,
  RecordFollowupRequested,
} from './followups.repository.js';
export { FollowupsSubscriber } from './followups.subscriber.js';
