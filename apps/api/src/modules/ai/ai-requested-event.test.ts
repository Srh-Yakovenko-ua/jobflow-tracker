import { describe, expect, expectTypeOf, it } from 'vitest';

import type { InTransaction } from '../../prisma/in-transaction.js';
import { AI_JOB_ID } from '../../test/ai.js';
import { APPLICATION_ID, OLENA_ID, SEARCH_ID } from '../../test/service-fixtures.js';
import {
  aiRequestedEvent,
  aiRequestedOutbox,
  type RecordAiRequested,
} from './ai-requested-event.js';

const EVENT = aiRequestedEvent('application.cv_hints_requested', {});

describe('aiRequestedOutbox', () => {
  it.each([
    {
      case: 'the application of a request that names one',
      requested: { applicationId: APPLICATION_ID, aiJobId: AI_JOB_ID },
      aggregate: { aggregate: 'application', aggregateId: APPLICATION_ID },
    },
    {
      case: 'the user of a request without an application',
      requested: { searchId: SEARCH_ID, aiJobId: AI_JOB_ID },
      aggregate: { aggregate: 'user', aggregateId: OLENA_ID },
    },
  ])(
    'files the outbox row under $case with the user in its payload',
    ({ requested, aggregate }) => {
      expect(aiRequestedOutbox(OLENA_ID, { event: EVENT, requested })).toMatchObject({
        ...aggregate,
        eventType: 'application.cv_hints_requested',
        payload: { userId: OLENA_ID, ...requested },
      });
    },
  );
});

describe('RecordAiRequested', () => {
  it('cannot be recorded without the transaction of its ai job', () => {
    expectTypeOf<Pick<RecordAiRequested, 'tx'>>().toEqualTypeOf<Required<InTransaction>>();
  });
});
