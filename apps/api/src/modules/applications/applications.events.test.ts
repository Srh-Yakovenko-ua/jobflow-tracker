import { describe, expect, it } from 'vitest';

import { OLENA_ID } from '../../test/service-fixtures.js';
import { insideSpan, recordSpans, traceparentOf } from '../../test/tracing.js';
import { applicationEvent } from './applications.events.js';

const APPLICATION_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f10';

const CREATED = { eventType: 'application.created', applicationId: APPLICATION_ID } as const;

const CREATED_ROW = {
  aggregate: 'application',
  aggregateId: APPLICATION_ID,
  eventType: 'application.created',
  payload: { userId: OLENA_ID, applicationId: APPLICATION_ID },
};

recordSpans();

describe('applicationEvent', () => {
  it('stamps the outbox row with the traceparent of the active span', async () => {
    const { row, spanContext } = await insideSpan((span) => ({
      row: applicationEvent(OLENA_ID, CREATED),
      spanContext: span.spanContext(),
    }));

    expect(row).toEqual({ ...CREATED_ROW, traceparent: traceparentOf(spanContext) });
  });

  it('writes the row unchanged outside any span', () => {
    expect(applicationEvent(OLENA_ID, CREATED)).toEqual(CREATED_ROW);
  });
});
