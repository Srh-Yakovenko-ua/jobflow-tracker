import { buildMonthlySummaryInput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import { settlingThrough } from '../../test/notifications.js';
import { OLENA_ID } from '../../test/service-fixtures.js';
import type { SettledAiJob } from '../ai/index.js';
import { SummaryNotificationsSubscriber } from './summary-notifications.subscriber.js';

const SUMMARY_JOB = {
  aiJobId: AI_JOB_ID,
  userId: OLENA_ID,
  kind: 'monthly_summary',
  input: buildMonthlySummaryInput(),
} satisfies SettledAiJob['job'];

const settling = () => settlingThrough(SummaryNotificationsSubscriber);

describe('SummaryNotificationsSubscriber', () => {
  it('records monthly_summary_ready with the job and the summarized month of a done summary', async () => {
    const { notifications, settle } = await settling();

    await settle({ job: SUMMARY_JOB, status: 'done', output: {} });

    expect(notifications.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'monthly_summary_ready',
        payload: { aiJobId: AI_JOB_ID, month: '2026-08' },
      },
    ]);
  });

  it('records nothing for a failed summary', async () => {
    const { notifications, settle } = await settling();

    await settle({ job: SUMMARY_JOB, status: 'failed', errorType: 'ai_unavailable' });

    expect(notifications.notifications).toEqual([]);
  });
});
