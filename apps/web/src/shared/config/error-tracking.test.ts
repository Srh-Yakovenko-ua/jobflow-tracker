import { ERROR_EVENT_DATA_COLLECTION } from '@jobflow/shared';
import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';

import { errorTrackingOptions } from './error-tracking';

const REPORTS_TO = { dsn: 'http://public@localhost:8003/1', release: '59dbb20' };

const LEAKY_EVENT: ErrorEvent = {
  type: undefined,
  event_id: '5f3a9c01e2b44d6f8a7b6c5d4e3f2a1b',
  message: 'ivan.petrenko@example.com',
  user: { email: 'ivan.petrenko@example.com' },
  exception: { values: [{ type: 'Error', value: 'нотатка: подзвонити Олені' }] },
  tags: { code: '5f3a9c01' },
};

function beforeSendOf(options: ReturnType<typeof errorTrackingOptions>) {
  const { beforeSend } = options;
  if (beforeSend === undefined) throw new Error('beforeSend is not set');
  return beforeSend;
}

describe('errorTrackingOptions', () => {
  it('reports to the DSN under the release, sends no breadcrumbs and collects no user data', () => {
    const options = errorTrackingOptions(REPORTS_TO);

    expect(options).toMatchObject({
      dsn: 'http://public@localhost:8003/1',
      release: '59dbb20',
      maxBreadcrumbs: 0,
      initialScope: { tags: { service: 'web' } },
      dataCollection: ERROR_EVENT_DATA_COLLECTION,
    });
  });

  it('drops the message, the user and the exception text before an event leaves', async () => {
    const beforeSend = beforeSendOf(errorTrackingOptions(REPORTS_TO));

    const sent = await beforeSend(LEAKY_EVENT, { originalException: new Error('boom') });

    expect(JSON.stringify(sent)).not.toContain('ivan.petrenko@example.com');
    expect(JSON.stringify(sent)).not.toContain('нотатка');
    expect(sent).toEqual({
      type: undefined,
      event_id: '5f3a9c01e2b44d6f8a7b6c5d4e3f2a1b',
      exception: { values: [{ type: 'Error' }] },
      tags: { code: '5f3a9c01' },
    });
  });

  it('tags a server crash with its Next digest, so the browser and server events meet', async () => {
    const beforeSend = beforeSendOf(errorTrackingOptions(REPORTS_TO));
    const thrown = Object.assign(new Error('boom'), { digest: '2349875623' });

    const sent = await beforeSend(LEAKY_EVENT, { originalException: thrown });

    expect(sent?.tags).toEqual({ code: '5f3a9c01', digest: '2349875623' });
  });
});
