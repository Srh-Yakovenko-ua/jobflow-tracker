import type { InterviewPrepResponse } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import type { AiJob } from '@/shared/ui/async-state';
import { errorReply, rateLimitedReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import {
  interviewPrepJob,
  interviewPrepRoutes,
  NO_INTERVIEW_PREP,
  READY_INTERVIEW_PREP,
} from '@/test/interview-prep-fixtures';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { InterviewPrepPanel } from './interview-prep-panel';

const PROCESSING: AiJob = { status: 'processing', step: 2, steps: 3 };

const NOTHING_TO_BUILD_FROM =
  'Підготовку не скласти: потрібна запланована співбесіда, а у вакансії мають бути вимоги або Match Score.';

afterEach(() => {
  toast.dismiss();
});

function renderPanel(response: InterviewPrepResponse) {
  const routes = interviewPrepRoutes(response);
  server.use(...routes.handlers);
  const { user } = renderViewInApp(
    <InterviewPrepPanel application={ACME_APPLICATION} prep={{ response, job: PROCESSING }} />,
  );
  return { user, routes };
}

const textsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map(({ textContent }) => textContent);

describe('InterviewPrepPanel', () => {
  it('before any pack says what it holds and that notes stay out, then asks for it once', async () => {
    const { user, routes } = renderPanel(NO_INTERVIEW_PREP);

    expect(screen.getByText(/Нотатки в модель не йдуть/)).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Підготувати' }));

    await expect.poll(() => routes.requested).toEqual([ACME_APPLICATION.id]);
  });

  it('while the pack is processing shows the running step and nothing to press', () => {
    renderPanel(interviewPrepJob('processing'));

    expect(screen.getByText('крок 2 з 3 · обробляється')).toBeDefined();
    expect(screen.getByText('Можеш закрити картку: підготовка зʼявиться тут.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lists the likely topics most likely first, each with why it may come up', () => {
    renderPanel(READY_INTERVIEW_PREP);

    const topics = textsOf(screen.getByRole('list', { name: 'Ймовірні теми' }));

    expect(topics).toHaveLength(5);
    expect(topics[0]).toBe(
      'React + TypeScriptОсновний стек вакансії, на техінтерв’ю його перевіряють першим.',
    );
    expect(topics[3]).toBe('AWSВакансія просить AWS, а в CV його немає.');
  });

  it('gives 10 practice questions with a hint each, not an answer', () => {
    renderPanel(READY_INTERVIEW_PREP);

    const questions = textsOf(screen.getByRole('list', { name: 'Питання для практики' }));

    expect(questions).toHaveLength(10);
    expect(questions[2]).toBe(
      'Розкажи, як ти підходиш до задачі на GraphQL?Підказка: Почни з обмежень задачі, назви складність рішення і чесно скажи, що перевіриш тестом.',
    );
  });

  it('gives the 3 questions to ask the company', () => {
    renderPanel(READY_INTERVIEW_PREP);

    expect(textsOf(screen.getByRole('list', { name: 'Що спитати в компанії' }))).toEqual([
      'Як виглядає перший місяць у команді?',
      'Хто рев’юїть код і як швидко?',
      'Яка частка часу йде на підтримку, а яка на нові фічі?',
    ]);
  });

  it('shows the 30 minute plan first and the 2 hour plan once switched', async () => {
    const { user } = renderPanel(READY_INTERVIEW_PREP);

    expect(textsOf(screen.getByRole('list', { name: 'План на 30 хвилин' }))).toEqual([
      '15 хвПройди дві задачі на масиви вголос.',
      '15 хвПеречитай вимоги вакансії і підготуй приклад з React.',
    ]);
    await user.click(screen.getByRole('radio', { name: '2 год' }));

    expect(textsOf(await screen.findByRole('list', { name: 'План на 2 години' }))).toEqual([
      '45 хвРозв’яжи три задачі на алгоритми з таймером.',
      '45 хвЗроби маленький GraphQL-запит у пет-проєкті.',
      '30 хвПрочитай огляд сервісів AWS, які згадує вакансія.',
    ]);
    expect(screen.queryByRole('list', { name: 'План на 30 хвилин' })).toBeNull();
  });

  it('a job failed on the time limit says so and «Спробувати ще раз» asks again', async () => {
    const { user, routes } = renderPanel(interviewPrepJob('failed', 'ai_timeout'));

    expect(screen.getByText('Модель не відповіла за 30 секунд.')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    await expect.poll(() => routes.requested).toEqual([ACME_APPLICATION.id]);
  });

  it('a refused request, such as the hourly AI limit, fails with a retry', async () => {
    const { user, routes } = renderPanel(NO_INTERVIEW_PREP);
    routes.refuse(() => rateLimitedReply({ 'Retry-After': '120' }));

    await user.click(screen.getByRole('button', { name: 'Підготувати' }));

    expect(await screen.findByText('Підготовка не вийшла.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeDefined();
  });

  it('a 409 with nothing to build from explains what the pack needs and offers no retry', async () => {
    const { user, routes } = renderPanel(NO_INTERVIEW_PREP);
    routes.refuse(() => errorReply({ status: 409, type: 'conflict' }));

    await user.click(screen.getByRole('button', { name: 'Підготувати' }));

    expect(await screen.findByText(NOTHING_TO_BUILD_FROM)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Підготувати' })).toBeNull();
  });
});
