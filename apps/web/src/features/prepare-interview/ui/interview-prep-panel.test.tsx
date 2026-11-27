import type { InterviewPrepResponse } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
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
  readyInterviewPrepAt,
} from '@/test/interview-prep-fixtures';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { InterviewPrepPanel } from './interview-prep-panel';

type PanelSetup = Readonly<{ response: InterviewPrepResponse; requestable?: boolean }>;

const PROCESSING: AiJob = { status: 'processing', step: 2, steps: 3 };

const REQUEST = { name: 'Підготувати до співбесіди' } as const;

const NOTHING_TO_BUILD_FROM =
  'Для підготовки потрібна запланована співбесіда і вимоги або Match Score у вакансії.';

const SHOW_QUESTIONS = { name: 'Показати питання для практики' } as const;

const CHECKLIST_KEY = `jobflow.interview-prep.${ME_RESPONSE.user.id}`;

afterEach(() => {
  toast.dismiss();
  localStorage.clear();
});

function renderPanel({ response, requestable = true }: PanelSetup) {
  const routes = interviewPrepRoutes(response);
  server.use(meRoute(), ...routes.handlers);
  const { user, view } = renderViewInApp(
    <InterviewPrepPanel
      application={ACME_APPLICATION}
      prep={{ response, job: PROCESSING, requestable }}
    />,
  );
  return { user, routes, view };
}

const textsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map(({ textContent }) => textContent);

const checkedOf = () =>
  screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-checked'));

function storedTopicBox(name: string) {
  return waitFor(() => {
    const box = screen.getByRole('checkbox', { name });
    if (box.hasAttribute('disabled')) throw new Error(`${name} waits for the signed in user`);
    return box;
  });
}

describe('InterviewPrepPanel', () => {
  it('before any pack says what it holds and names the dictionary theme words, then asks for it once', async () => {
    const { user, routes } = renderPanel({ response: NO_INTERVIEW_PREP });

    expect(screen.getByText(/Нотаток він не бачить/)).toBeDefined();
    await user.click(screen.getByRole('button', REQUEST));

    await expect.poll(() => routes.requested).toEqual([ACME_APPLICATION.id]);
  });

  it('with no pack and no planned interview explains what the pack needs and offers nothing to press', () => {
    renderPanel({ response: NO_INTERVIEW_PREP, requestable: false });

    expect(screen.getByText(NOTHING_TO_BUILD_FROM)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('while the pack is processing shows the running step and nothing to press', () => {
    renderPanel({ response: interviewPrepJob('processing') });

    expect(screen.getByText('крок 2/3 · обробляється')).toBeDefined();
    expect(screen.getByText('Можеш закрити картку: підготовка зʼявиться тут.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lists the likely topics as a checklist, most likely first, none checked yet', () => {
    renderPanel({ response: READY_INTERVIEW_PREP });

    const topics = within(screen.getByRole('list', { name: 'Ймовірні теми' }));

    expect(topics.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual(
      ['React + TypeScript', 'Алгоритми', 'Live coding', 'AWS', 'GraphQL'],
    );
    expect(checkedOf()).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it('keeps the checked topics after the card is closed and opened again, storing only their places', async () => {
    const { user, view } = renderPanel({ response: READY_INTERVIEW_PREP });
    await user.click(await storedTopicBox('React + TypeScript'));
    await user.click(screen.getByRole('checkbox', { name: 'AWS' }));
    view.unmount();

    renderPanel({ response: READY_INTERVIEW_PREP });

    await waitFor(() => {
      expect(checkedOf()).toEqual(['true', 'false', 'false', 'true', 'false']);
    });
    expect(JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? '')).toEqual({
      [ACME_APPLICATION.id]: { generatedAt: '2026-11-15T09:00:00.000Z', checked: [0, 3] },
    });
  });

  it('a new pack starts with nothing checked', async () => {
    const { user, view } = renderPanel({ response: READY_INTERVIEW_PREP });
    await user.click(await storedTopicBox('React + TypeScript'));
    view.unmount();

    renderPanel({ response: readyInterviewPrepAt('2026-11-16T09:00:00.000Z') });

    await storedTopicBox('React + TypeScript');
    expect(checkedOf()).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it.each([
    [
      'React + TypeScript',
      'Основний стек вакансії, на техінтерв’ю його перевіряють першим.Вимога вакансіїReact + TypeScript',
    ],
    [
      'Алгоритми',
      "Три відмови на техінтерв'ю через скіли, і нотатки згадують алгоритми.Слабке місце з аналітикиАлгоритми",
    ],
  ])('«Чому ця тема?» on %s tells why and where it came from', async (topic, text) => {
    const { user } = renderPanel({ response: READY_INTERVIEW_PREP });

    await user.click(screen.getByRole('button', { name: `Чому ця тема? ${topic}` }));

    const popover = await screen.findByRole('dialog', { name: `Чому ця тема? ${topic}` });
    expect(popover.textContent).toBe(text);
  });

  it('keeps the practice questions closed, then shows 10 and reveals a hint, not an answer, on the one asked', async () => {
    const { user } = renderPanel({ response: READY_INTERVIEW_PREP });
    const toggle = screen.getByRole('button', SHOW_QUESTIONS);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Питання для практики' })).toBeNull();
    await user.click(toggle);

    const list = await screen.findByRole('list', { name: 'Питання для практики' });
    const question = within(list).getByRole('button', {
      name: 'Розкажи, як ти підходиш до задачі на GraphQL?',
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.queryByText(/^Підказка:/)).toBeNull();
    await user.click(question);

    expect(question.getAttribute('aria-expanded')).toBe('true');
    expect(
      await screen.findByText(
        'Підказка: Почни з обмежень задачі, назви складність рішення і чесно скажи, що перевіриш тестом.',
      ),
    ).toBeDefined();
  });

  it('works by keyboard alone: a checkbox, its source, the questions and a hint', async () => {
    const { user } = renderPanel({ response: READY_INTERVIEW_PREP });
    const first = await storedTopicBox('React + TypeScript');

    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard(' ');
    expect(first.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem(CHECKLIST_KEY)).toContain('"checked":[0]');

    await user.tab();
    const why = screen.getByRole('button', { name: 'Чому ця тема? React + TypeScript' });
    expect(document.activeElement).toBe(why);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeDefined();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(why);

    screen.getByRole('button', SHOW_QUESTIONS).focus();
    await user.keyboard('{Enter}');
    const list = await screen.findByRole('list', { name: 'Питання для практики' });
    await user.tab();
    expect(document.activeElement).toBe(within(list).getAllByRole('button')[0]);
    await user.keyboard('{Enter}');
    expect(await screen.findAllByText(/^Підказка:/)).toHaveLength(1);
  });

  it('gives the 3 questions to ask the company', () => {
    renderPanel({ response: READY_INTERVIEW_PREP });

    expect(textsOf(screen.getByRole('list', { name: 'Що спитати в компанії' }))).toEqual([
      'Як виглядає перший місяць у команді?',
      'Хто рев’юїть код і як швидко?',
      'Яка частка часу йде на підтримку, а яка на нові фічі?',
    ]);
  });

  it('shows the 30 minute plan first and the 2 hour plan once switched', async () => {
    const { user } = renderPanel({ response: READY_INTERVIEW_PREP });

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
    const { user, routes } = renderPanel({ response: interviewPrepJob('failed', 'ai_timeout') });

    expect(screen.getByText('AI не відповів за 30 секунд.')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    await expect.poll(() => routes.requested).toEqual([ACME_APPLICATION.id]);
  });

  it('a refused request, such as the hourly AI limit, fails with a retry', async () => {
    const { user, routes } = renderPanel({ response: NO_INTERVIEW_PREP });
    routes.refuse(() => rateLimitedReply({ 'Retry-After': '120' }));

    await user.click(screen.getByRole('button', REQUEST));

    expect(await screen.findByText('Підготовка не вийшла.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeDefined();
    expect(toast.getToasts()).toEqual([]);
  });

  it('a 409 with nothing to build from explains what the pack needs and offers no retry', async () => {
    const { user, routes } = renderPanel({ response: NO_INTERVIEW_PREP });
    routes.refuse(() => errorReply({ status: 409, type: 'conflict' }));

    await user.click(screen.getByRole('button', REQUEST));

    expect(await screen.findByText(NOTHING_TO_BUILD_FROM)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull();
    expect(screen.queryByRole('button', REQUEST)).toBeNull();
  });
});
