import { CALENDAR_OPENAPI_PATHS } from './calendar.openapi.js';
import { SCHEDULED_EVENTS_OPENAPI_PATHS } from './scheduled-events.openapi.js';

export { ScheduleModule } from './schedule.module.js';

export const SCHEDULE_OPENAPI_PATHS = [
  ...SCHEDULED_EVENTS_OPENAPI_PATHS,
  ...CALENDAR_OPENAPI_PATHS,
];
