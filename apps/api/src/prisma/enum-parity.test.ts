import {
  OAUTH_PROVIDERS,
  REJECTION_SIDES,
  SCHEDULED_EVENT_KINDS,
  SCHEDULED_EVENT_STATUSES,
  SEARCH_STATUSES,
  SOURCES,
  STAGES,
  THEMES,
  TIMELINE_EVENT_KINDS,
  WORK_MODES,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import {
  OAuthProvider,
  RejectionSide,
  ScheduledEventKind,
  ScheduledEventStatus,
  SearchStatus,
  Source,
  Stage,
  Theme,
  TimelineEventKind,
  WorkMode,
} from '../generated/prisma/enums.js';

describe('Prisma enums', () => {
  it.each([
    { name: 'Theme', generated: Theme, shared: THEMES },
    { name: 'OAuthProvider', generated: OAuthProvider, shared: OAUTH_PROVIDERS },
    { name: 'Stage', generated: Stage, shared: STAGES },
    { name: 'Source', generated: Source, shared: SOURCES },
    { name: 'WorkMode', generated: WorkMode, shared: WORK_MODES },
    { name: 'RejectionSide', generated: RejectionSide, shared: REJECTION_SIDES },
    { name: 'SearchStatus', generated: SearchStatus, shared: SEARCH_STATUSES },
    { name: 'ScheduledEventKind', generated: ScheduledEventKind, shared: SCHEDULED_EVENT_KINDS },
    {
      name: 'ScheduledEventStatus',
      generated: ScheduledEventStatus,
      shared: SCHEDULED_EVENT_STATUSES,
    },
    { name: 'TimelineEventKind', generated: TimelineEventKind, shared: TIMELINE_EVENT_KINDS },
  ])('keeps $name equal to the list in @jobflow/shared', ({ generated, shared }) => {
    expect(new Set(Object.values(generated))).toEqual(new Set(shared));
  });
});
