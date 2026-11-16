import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { fixtureIdOf } from '@/test/board-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { useTopicChecklist } from './use-topic-checklist';

const CHECKLIST_KEY = `jobflow.interview-prep.${ME_RESPONSE.user.id}`;

const GENERATED_AT = '2026-11-15T09:00:00.000Z';

const OTHER_APPLICATION_ID = fixtureIdOf(777);

afterEach(() => {
  localStorage.clear();
});

describe('useTopicChecklist', () => {
  it('a tick in one tab survives a write in another', async () => {
    server.use(meRoute());
    const { result } = renderHookInApp(() =>
      useTopicChecklist({ applicationId: ACME_APPLICATION.id, generatedAt: GENERATED_AT }),
    );
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    localStorage.setItem(
      CHECKLIST_KEY,
      JSON.stringify({
        [ACME_APPLICATION.id]: { generatedAt: GENERATED_AT, checked: [2] },
        [OTHER_APPLICATION_ID]: { generatedAt: GENERATED_AT, checked: [1] },
      }),
    );

    act(() => {
      result.current.toggle(0);
    });

    expect(JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? '')).toEqual({
      [ACME_APPLICATION.id]: { generatedAt: GENERATED_AT, checked: [0, 2] },
      [OTHER_APPLICATION_ID]: { generatedAt: GENERATED_AT, checked: [1] },
    });
    expect([0, 1, 2].map(result.current.isChecked)).toEqual([true, false, true]);
  });
});
