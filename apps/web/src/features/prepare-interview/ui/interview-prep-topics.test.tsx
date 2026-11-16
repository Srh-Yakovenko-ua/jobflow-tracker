import { INTERVIEW_PREP_OUTPUT } from '@jobflow/shared/testing';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { InterviewPrepTopics } from './interview-prep-topics';

const [TOPIC] = INTERVIEW_PREP_OUTPUT.topics;

afterEach(() => {
  localStorage.clear();
});

describe('InterviewPrepTopics', () => {
  it('two topics with the same name render two rows that tick apart', async () => {
    if (TOPIC === undefined) throw new Error('the prep output has topics');
    const logged = vi.spyOn(console, 'error');
    server.use(meRoute());
    const result = {
      ...INTERVIEW_PREP_OUTPUT,
      generatedAt: '2026-11-15T09:00:00.000Z',
      topics: [TOPIC, { ...TOPIC, why: 'Друга тема з тією ж назвою.' }],
    };
    const user = renderInApp(
      <InterviewPrepTopics application={ACME_APPLICATION} result={result} />,
    );
    const boxes = () => screen.getAllByRole('checkbox', { name: TOPIC.name });
    const second = await waitFor(() => {
      const [, box] = boxes();
      if (box === undefined || box.hasAttribute('disabled')) throw new Error('the twin waits');
      return box;
    });

    await user.click(second);

    expect(boxes().map((box) => box.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(logged.mock.calls.flat().join(' ')).not.toContain('same key');
    logged.mockRestore();
  });
});
