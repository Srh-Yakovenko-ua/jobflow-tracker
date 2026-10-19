import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  SCHEDULED_EVENT_KINDS,
  SCHEDULED_EVENT_STATUSES,
  scheduledEventKindSchema,
  scheduledEventStatusSchema,
} from './scheduled-events.js';
import { SEARCH_STATUSES, searchStatusSchema } from './searches.js';
import { TIMELINE_EVENT_KINDS, timelineEventKindSchema } from './timeline-events.js';

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
];

describe('domain enum schemas', () => {
  it.each(DOMAIN_ENUMS)('$name accepts every member and refuses an unknown one', (domainEnum) => {
    expect(domainEnum.values.map((value) => domainEnum.schema.parse(value))).toEqual([
      ...domainEnum.values,
    ]);
    expect(domainEnum.schema.safeParse('unknown_value').success).toBe(false);
  });
});
