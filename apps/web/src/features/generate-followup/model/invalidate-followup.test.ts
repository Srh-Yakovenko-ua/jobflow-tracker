import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { reminderKeys } from '@/entities/reminder';
import { userKeys } from '@/entities/user';
import { ACME_APPLICATION } from '@/test/application-fixtures';

import { invalidateFollowup } from './invalidate-followup';

describe('invalidateFollowup', () => {
  it('marking a follow-up sent refreshes rhythm and reminders', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(userKeys.rhythm(), {});
    queryClient.setQueryData(reminderKeys.list(), []);

    await invalidateFollowup({ queryClient, applicationId: ACME_APPLICATION.id });

    expect([
      queryClient.getQueryState(userKeys.rhythm())?.isInvalidated,
      queryClient.getQueryState(reminderKeys.list())?.isInvalidated,
    ]).toEqual([true, true]);
  });
});
