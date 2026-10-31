import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { AI_KINDS, aiKindSchema } from './ai/kinds.js';
import {
  AI_JOB_STATUSES,
  AI_RESULT_STATUSES,
  aiJobStatusSchema,
  aiResultStatusSchema,
} from './ai-statuses.js';
import { NOTIFICATION_TYPES, notificationTypeSchema } from './notifications.js';
import {
  REMINDER_STATUSES,
  REMINDER_TYPES,
  reminderStatusSchema,
  reminderTypeSchema,
} from './reminders.js';
import {
  SCHEDULED_EVENT_KINDS,
  SCHEDULED_EVENT_STATUSES,
  scheduledEventKindSchema,
  scheduledEventStatusSchema,
} from './scheduled-events.js';
import { SEARCH_STATUSES, searchStatusSchema } from './searches.js';
import { TIMELINE_EVENT_KINDS, timelineEventKindSchema } from './timeline-events.js';
import { TOKEN_SCOPES, tokenScopeSchema } from './token-scopes.js';

type DomainEnumCase = { name: string; values: readonly string[]; schema: z.ZodType };

const DOMAIN_ENUMS: DomainEnumCase[] = [
  { name: 'search status', values: SEARCH_STATUSES, schema: searchStatusSchema },
  { name: 'scheduled event kind', values: SCHEDULED_EVENT_KINDS, schema: scheduledEventKindSchema },
  {
    name: 'scheduled event status',
    values: SCHEDULED_EVENT_STATUSES,
    schema: scheduledEventStatusSchema,
  },
  { name: 'timeline event kind', values: TIMELINE_EVENT_KINDS, schema: timelineEventKindSchema },
  { name: 'reminder type', values: REMINDER_TYPES, schema: reminderTypeSchema },
  { name: 'reminder status', values: REMINDER_STATUSES, schema: reminderStatusSchema },
  { name: 'notification type', values: NOTIFICATION_TYPES, schema: notificationTypeSchema },
  { name: 'ai job status', values: AI_JOB_STATUSES, schema: aiJobStatusSchema },
  { name: 'ai result status', values: AI_RESULT_STATUSES, schema: aiResultStatusSchema },
  { name: 'ai kind', values: AI_KINDS, schema: aiKindSchema },
  { name: 'token scope', values: TOKEN_SCOPES, schema: tokenScopeSchema },
];

describe('domain enum schemas', () => {
  it.each(DOMAIN_ENUMS)('$name accepts every member and refuses an unknown one', (domainEnum) => {
    expect(domainEnum.values.map((value) => domainEnum.schema.parse(value))).toEqual([
      ...domainEnum.values,
    ]);
    expect(domainEnum.schema.safeParse('unknown_value').success).toBe(false);
  });
});
