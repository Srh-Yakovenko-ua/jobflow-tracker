import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { scheduledEventKeys } from '@/entities/scheduled-event';
import { ACME_APPLICATION } from '@/test/application-fixtures';

import { invalidateAfterSchedule } from './invalidate-after-schedule';

const WEEK = { from: '2026-11-01T22:00:00.000Z', to: '2026-11-08T22:00:00.000Z' };

describe('invalidateAfterSchedule', () => {
  it('marks every calendar range stale, so an event saved in the sheet over /calendar shows on the grid', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(scheduledEventKeys.calendar(WEEK), { items: [] });

    await invalidateAfterSchedule({ queryClient, applicationId: ACME_APPLICATION.id });

    expect(queryClient.getQueryState(scheduledEventKeys.calendar(WEEK))?.isInvalidated).toBe(true);
  });
});
