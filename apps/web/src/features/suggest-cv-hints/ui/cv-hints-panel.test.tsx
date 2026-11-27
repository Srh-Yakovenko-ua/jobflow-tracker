import type { CvHintsResponse } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import type { AiJob } from '@/shared/ui/async-state';
import { rateLimitedReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import {
  cvHintsJob,
  cvHintsRoutes,
  EMPTY_CV_HINTS,
  NO_CV_HINTS,
  READY_CV_HINTS,
} from '@/test/cv-hints-fixtures';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { CvHintsPanel } from './cv-hints-panel';

const QUEUED: AiJob = { status: 'queued', ahead: 2, etaSeconds: 30 };

const PROCESSING: AiJob = { status: 'processing', step: 2, steps: 3 };

const SUGGESTION =
  'Підніми рядок про дашборд Acme вище і назви в ньому API, з якими працював дашборд, якщо серед них був GraphQL.';

afterEach(() => {
  toast.dismiss();
});

function renderPanel(response: CvHintsResponse, job: AiJob = PROCESSING) {
  const routes = cvHintsRoutes(response);
  server.use(...routes.handlers);
  const { user } = renderViewInApp(
    <CvHintsPanel application={ACME_APPLICATION} hints={{ response, job }} />,
  );
  return { user, routes };
}

describe('CvHintsPanel', () => {
  it('before any hints says what the AI does and asks for them once', async () => {
    const { user, routes } = renderPanel(NO_CV_HINTS);

    expect(screen.getByText(/без вигаданого досвіду/)).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Підказати' }));

    await expect.poll(() => routes.requested).toEqual([ACME_APPLICATION.id]);
  });

  it('while the hints are queued shows the queue line and nothing to press', () => {
    renderPanel(cvHintsJob('queued'), QUEUED);

    expect(screen.getByText(/у черзі · 2 задачі перед твоєю/)).toBeDefined();
    expect(screen.getByText('Можеш закрити картку: підказки зʼявляться тут.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('while the hints are processing shows the running step', () => {
    renderPanel(cvHintsJob('processing'));

    expect(screen.getByText('крок 2/3 · обробляється')).toBeDefined();
  });

  it('a done hint shows its requirement, the most it can add, the CV line it rests on and the suggestion', () => {
    renderPanel(READY_CV_HINTS);

    const hints = screen.getByRole('list', { name: 'Підказки' });
    const [row] = within(hints).getAllByRole('listitem');

    expect(row?.textContent).toBe(
      `GraphQLдо +5у резюме: «Built the Acme dashboard in React»${SUGGESTION}`,
    );
  });

  it('the copy button of a hint copies its suggestion and is named after the requirement', async () => {
    const { user } = renderPanel(READY_CV_HINTS);

    await user.click(screen.getByRole('button', { name: 'Скопіювати підказку про «GraphQL»' }));

    expect(await screen.findByText('Скопійовано')).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe(SUGGESTION);
  });

  it('lists every gap wording cannot close, warning not to add experience the CV lacks', () => {
    renderPanel(READY_CV_HINTS);

    const gaps = screen.getByRole('list', { name: 'Чого формулюванням не закрити' });

    expect(
      within(gaps)
        .getAllByRole('listitem')
        .map(({ textContent }) => textContent),
    ).toEqual([
      'AWS / інфраструктура: у резюме немає досвіду, не додавай того, чого не було',
      'Досвід ліда команди 3+: у резюме немає досвіду, не додавай того, чого не було',
    ]);
  });

  it('done with no hints and no gaps says there is nothing to reword', () => {
    renderPanel(EMPTY_CV_HINTS);

    expect(screen.getByText('AI не знайшов рядків, які варто підсилити.')).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    { errorType: 'ai_timeout' as const, copy: 'AI не відповів за 30 секунд.' },
    { errorType: 'ai_unavailable' as const, copy: 'Підказки не вийшли.' },
  ])(
    'a job failed with $errorType says why and «Спробувати ще раз» asks again',
    async ({ errorType, copy }) => {
      const { user, routes } = renderPanel(cvHintsJob('failed', errorType));

      expect(screen.getByText('AI не впорався')).toBeDefined();
      expect(screen.getByText(copy)).toBeDefined();
      await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

      await expect.poll(() => routes.requested).toEqual([ACME_APPLICATION.id]);
    },
  );

  it('a refused request, such as the hourly AI limit, fails with a retry', async () => {
    const { user, routes } = renderPanel(NO_CV_HINTS);
    routes.refuse(() => rateLimitedReply({ 'Retry-After': '120' }));

    await user.click(screen.getByRole('button', { name: 'Підказати' }));

    expect(await screen.findByText('Підказки не вийшли.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeDefined();
    expect(toast.getToasts()).toEqual([]);
  });
});
