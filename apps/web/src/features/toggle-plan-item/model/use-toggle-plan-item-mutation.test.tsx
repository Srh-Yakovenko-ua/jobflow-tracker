import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { latestPlanQueryOptions } from '@/entities/plan';
import { uk } from '@/shared/i18n';
import { errorReply, NEVER_ANSWERS } from '@/test/api-handlers';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { DESIGN_PLAN, type PlanRouteOptions, planRoutes } from '@/test/plan-fixtures';
import { REMINDER_NOW } from '@/test/reminder-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useTogglePlanItemMutation } from './use-toggle-plan-item-mutation';

const [FIRST, , , LAST] = DESIGN_PLAN.items;

pinClockInEachTest(REMINDER_NOW);

afterEach(() => {
  toast.dismiss();
});

function renderToggle(routes: PlanRouteOptions = {}) {
  const plans = planRoutes(routes);
  server.use(...plans.handlers);
  const { result } = renderHookInApp(() => ({
    toggle: useTogglePlanItemMutation(),
    queryClient: useQueryClient(),
  }));
  act(() => {
    result.current.queryClient.setQueryData(latestPlanQueryOptions().queryKey, {
      plan: DESIGN_PLAN,
    });
  });
  return { result, sent: plans.sent };
}

function doneAtOf(queryClient: QueryClient, itemId: string | undefined) {
  const latest = queryClient.getQueryData(latestPlanQueryOptions().queryKey);
  return latest?.plan?.items.find((item) => item.id === itemId)?.doneAt;
}

describe('useTogglePlanItemMutation', () => {
  it('checks the item in the cache at once and sends done true for it', async () => {
    const { result, sent } = renderToggle({ patchReply: NEVER_ANSWERS.reply });

    act(() => {
      result.current.toggle.mutate({
        planId: DESIGN_PLAN.id,
        itemId: LAST?.id ?? '',
        patch: { done: true },
      });
    });

    await waitFor(() => {
      expect(doneAtOf(result.current.queryClient, LAST?.id)).toBe(REMINDER_NOW.toISOString());
    });
    await waitFor(() => {
      expect(sent.patches).toEqual([
        { planId: DESIGN_PLAN.id, itemId: LAST?.id, body: { done: true } },
      ]);
    });
  });

  it('a 500 puts the item back as it was and says the check failed', async () => {
    const { result } = renderToggle({
      patchReply: () => errorReply({ status: 500, type: 'internal_error' }),
    });

    act(() => {
      result.current.toggle.mutate({
        planId: DESIGN_PLAN.id,
        itemId: FIRST?.id ?? '',
        patch: { done: false },
      });
    });

    expect(await screen.findByText(uk.reminders.plan.toggleFailed.title)).toBeDefined();
    expect(doneAtOf(result.current.queryClient, FIRST?.id)).toBe('2026-11-05T09:00:00.000Z');
  });
});
