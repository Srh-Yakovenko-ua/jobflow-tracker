import type { FollowupResponse } from '@jobflow/shared';
import { screen } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import type { AiJob } from '@/shared/ui/async-state';
import { rateLimitedReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import {
  DESIGN_FOLLOWUP,
  FAILED_AFTER_DRAFT,
  followupJob,
  followupRoutes,
  NO_FOLLOWUP,
  READY_FOLLOWUP,
} from '@/test/followup-fixtures';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { FollowupPanel } from './followup-panel';

type PanelSetup = Readonly<{ job?: AiJob; generateReply?: HttpResponseResolver }>;

const PROCESSING: AiJob = { status: 'processing', step: 2, steps: 3 };

const QUEUED: AiJob = { status: 'queued', ahead: 2, etaSeconds: 30 };

const TIMEOUT_COPY = 'AI не відповів за 30 секунд.';

const OTHER_COPY = 'Лист не вийшов.';

const BUDGET_COPY = 'Ліміт AI на сьогодні вичерпано, напиши лист вручну.';

afterEach(() => {
  toast.dismiss();
  sessionStorage.clear();
});

function renderPanel(
  response: FollowupResponse,
  { job = PROCESSING, generateReply }: PanelSetup = {},
) {
  const routes = followupRoutes({ response, generateReply });
  server.use(...routes.handlers);
  const ui = (
    <FollowupPanel
      application={ACME_APPLICATION}
      followup={{ response, job, queueRefused: false }}
    />
  );
  const { user, view } = renderViewInApp(ui);
  const reopen = () => {
    view.rerender(null);
    view.rerender(ui);
  };
  return { user, sent: routes.sent, reopen, view };
}

function draftFields() {
  return {
    subject: screen.getByRole<HTMLInputElement>('textbox', { name: 'Тема листа' }),
    body: screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Текст листа' }),
  };
}

async function writeOwnTextAndReopen(response: FollowupResponse) {
  const { user, reopen } = renderPanel(response);
  await user.click(screen.getByRole('button', { name: 'Написати вручну' }));
  await user.clear(draftFields().body);
  await user.type(draftFields().body, 'Дякую');
  reopen();
}

describe('FollowupPanel', () => {
  it('before any draft offers tone, the vacancy language and a hint, and asks for a first draft', async () => {
    const { user, sent } = renderPanel({ ...NO_FOLLOWUP, language: 'en' });

    expect(screen.getByText(/AI напише лист від твого імені/)).toBeDefined();
    expect(screen.getByRole('radio', { name: 'англійська' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByText('AI не бачить нотаток, тож важливе напиши тут.')).toBeDefined();
    await user.click(screen.getByRole('radio', { name: 'теплий' }));
    await user.type(screen.getByRole('textbox', { name: /Що згадати/ }), 'дорозвʼязав задачу');
    await user.click(screen.getByRole('button', { name: 'Згенерувати фоллоу-ап' }));

    await expect
      .poll(() => sent.requested)
      .toEqual([{ tone: 'warm', language: 'en', hint: 'дорозвʼязав задачу', variant: false }]);
  });

  it('a blank hint is left out of the request', async () => {
    const { user, sent } = renderPanel(NO_FOLLOWUP);

    await user.click(screen.getByRole('button', { name: 'Згенерувати фоллоу-ап' }));

    await expect
      .poll(() => sent.requested)
      .toEqual([{ tone: 'neutral', language: 'uk', variant: false }]);
  });

  it('while the draft is queued shows the queue line and that the card can be closed', () => {
    renderPanel(followupJob('queued'), { job: QUEUED });

    expect(screen.getByText(/у черзі · 2 задачі перед твоєю/)).toBeDefined();
    expect(
      screen.getByText('Можеш закрити картку: повідомимо, коли лист буде готовий.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Згенерувати фоллоу-ап' })).toBeNull();
  });

  it('a ready draft is editable and copies the edited subject and body together', async () => {
    const { user } = renderPanel(READY_FOLLOWUP);
    const { subject, body } = draftFields();

    expect(screen.getByText('лист готовий · можна правити')).toBeDefined();
    expect(subject.value).toBe(DESIGN_FOLLOWUP.subject);
    expect(body.value).toBe(DESIGN_FOLLOWUP.body);
    await user.clear(body);
    await user.type(body, 'Дякую!');
    await user.click(screen.getByRole('button', { name: 'Скопіювати' }));

    expect(await screen.findByText('Скопійовано')).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe(`${DESIGN_FOLLOWUP.subject}\n\nДякую!`);
  });

  it('«Ще варіант» asks for a fresh variant with the same tone and language', async () => {
    const { user, sent } = renderPanel(READY_FOLLOWUP);

    await user.click(screen.getByRole('button', { name: 'Ще варіант' }));

    await expect
      .poll(() => sent.requested)
      .toEqual([{ tone: 'neutral', language: 'uk', variant: true }]);
  });

  it('marking the draft sent records it once and says so', async () => {
    const { user, sent } = renderPanel(READY_FOLLOWUP);

    await user.click(screen.getByRole('button', { name: 'Позначити як надіслано' }));

    expect(await screen.findByText('Фоллоу-ап позначено надісланим')).toBeDefined();
    expect(sent.marked).toEqual([ACME_APPLICATION.id]);
  });

  it('while queued sweeps a track inside the section without a box of its own, and a running step has no sweep', () => {
    const { view } = renderPanel(followupJob('queued'), { job: QUEUED });

    expect(view.container.querySelector('.motion-safe\\:animate-sweep')).not.toBeNull();
    expect(screen.getByRole('status').classList).not.toContain('shadow-e1');

    view.rerender(
      <FollowupPanel
        application={ACME_APPLICATION}
        followup={{ response: followupJob('processing'), job: PROCESSING, queueRefused: false }}
      />,
    );
    expect(screen.getByText('крок 2/3 · обробляється')).toBeDefined();
    expect(view.container.querySelector('.motion-safe\\:animate-sweep')).toBeNull();
  });

  it('a ready draft can switch tone and language, and «Ще варіант» sends the new choice', async () => {
    const { user, sent } = renderPanel(READY_FOLLOWUP);

    await user.click(screen.getByRole('radio', { name: 'теплий' }));
    await user.click(screen.getByRole('radio', { name: 'англійська' }));
    await user.click(screen.getByRole('button', { name: 'Ще варіант' }));

    await expect
      .poll(() => sent.requested)
      .toEqual([{ tone: 'warm', language: 'en', variant: true }]);
  });

  it('an edited draft is still there after leaving and coming back, and gone once marked sent', async () => {
    const { user, reopen } = renderPanel(READY_FOLLOWUP);
    await user.clear(draftFields().body);
    await user.type(draftFields().body, 'Дякую!');

    reopen();
    expect(draftFields().body.value).toBe('Дякую!');

    await user.click(screen.getByRole('button', { name: 'Позначити як надіслано' }));
    await screen.findByText('Фоллоу-ап позначено надісланим');
    reopen();
    expect(draftFields().body.value).toBe(DESIGN_FOLLOWUP.body);
  });

  it('an own draft is still open after leaving and coming back', async () => {
    await writeOwnTextAndReopen(followupJob('failed', 'ai_timeout'));

    expect(screen.getByText('свій текст · пиши тут')).toBeDefined();
    expect(draftFields().body.value).toBe('Дякую');
  });

  it('a timed out draft shows the designed error, and «Написати вручну» opens an empty editor', async () => {
    const { user } = renderPanel(followupJob('failed', 'ai_timeout'));

    expect(screen.getByText(TIMEOUT_COPY)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Спробувати ще' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Написати вручну' }));

    const { subject, body } = draftFields();
    expect(subject.value).toBe('');
    expect(body.value).toBe('');
    expect(screen.queryByText(TIMEOUT_COPY)).toBeNull();
  });

  it('an empty own draft cannot be copied or marked sent until it has a body', async () => {
    const { user, sent } = renderPanel(followupJob('failed', 'ai_timeout'));
    await user.click(screen.getByRole('button', { name: 'Написати вручну' }));
    const copy = screen.getByRole<HTMLButtonElement>('button', { name: 'Скопіювати' });
    const markSent = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Позначити як надіслано',
    });

    await user.type(draftFields().subject, 'Тема');
    await user.type(draftFields().body, '   ');

    expect(copy.disabled).toBe(true);
    expect(markSent.disabled).toBe(true);
    await user.type(draftFields().body, 'Дякую');
    expect(copy.disabled).toBe(false);
    expect(markSent.disabled).toBe(false);
    expect(sent.marked).toEqual([]);
  });

  it('a draft failed on the daily AI budget opens the own text with the budget line and no retry', () => {
    renderPanel(followupJob('failed', 'budget_exceeded'));

    expect(screen.getByRole('alert').textContent).toContain(BUDGET_COPY);
    expect(screen.getByText('свій текст · пиши тут')).toBeDefined();
    expect(draftFields().body.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Спробувати ще' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ще варіант' })).toBeNull();
  });

  it('any other failed draft shows the plain error and «Спробувати ще» asks again', async () => {
    const { user, sent } = renderPanel(followupJob('failed', 'ai_invalid_output'));

    expect(screen.getByText(OTHER_COPY)).toBeDefined();
    expect(screen.queryByText(TIMEOUT_COPY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Спробувати ще' }));

    await expect
      .poll(() => sent.requested)
      .toEqual([{ tone: 'neutral', language: 'uk', variant: false }]);
  });

  it('after a refusal the request stays editable and «Спробувати ще» sends the changed tone and hint', async () => {
    const { user, sent } = renderPanel(NO_FOLLOWUP, {
      generateReply: () => rateLimitedReply({ 'Retry-After': '120' }),
    });
    await user.type(screen.getByRole('textbox', { name: /Що згадати/ }), 'дорозвʼязав');
    await user.click(screen.getByRole('button', { name: 'Згенерувати фоллоу-ап' }));
    await screen.findByText(OTHER_COPY);

    const hint = screen.getByRole<HTMLTextAreaElement>('textbox', { name: /Що згадати/ });
    expect(hint.value).toBe('дорозвʼязав');
    await user.click(screen.getByRole('radio', { name: 'короткий' }));
    await user.type(hint, ' задачу');
    await user.click(screen.getByRole('button', { name: 'Спробувати ще' }));

    await expect
      .poll(() => sent.requested)
      .toEqual([
        { tone: 'neutral', language: 'uk', hint: 'дорозвʼязав', variant: false },
        { tone: 'short', language: 'uk', hint: 'дорозвʼязав задачу', variant: false },
      ]);
  });

  it('a failed variant keeps the last good draft in the editor and shows the failure alert', () => {
    renderPanel(FAILED_AFTER_DRAFT);

    expect(draftFields().body.value).toBe(DESIGN_FOLLOWUP.body);
    expect(screen.getByRole('alert').textContent).toContain(TIMEOUT_COPY);
    expect(screen.getByRole('button', { name: 'Спробувати ще' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Написати вручну' })).toBeDefined();
  });

  it('own text started from a draft is still own text after a reload', async () => {
    await writeOwnTextAndReopen(FAILED_AFTER_DRAFT);

    expect(screen.getByText('свій текст · пиши тут')).toBeDefined();
    expect(draftFields().body.value).toBe('Дякую');
    expect(screen.queryByText(TIMEOUT_COPY)).toBeNull();
  });

  it('the edited letter survives a 429 on «Ще варіант», on screen and after coming back', async () => {
    const { user, reopen } = renderPanel(READY_FOLLOWUP, {
      generateReply: () => rateLimitedReply({ 'Retry-After': '120' }),
    });
    await user.clear(draftFields().body);
    await user.type(draftFields().body, 'Дякую!');

    await user.click(screen.getByRole('button', { name: 'Ще варіант' }));
    await screen.findByText(OTHER_COPY);

    expect(draftFields().body.value).toBe('Дякую!');
    reopen();
    expect(draftFields().body.value).toBe('Дякую!');
  });

  it('the subject and body stop at the follow-up limits of 120 and 1200 characters', () => {
    renderPanel(READY_FOLLOWUP);
    const { subject, body } = draftFields();

    expect(subject.maxLength).toBe(120);
    expect(body.maxLength).toBe(1200);
  });

  it('a refused request, such as the hourly AI limit, shows the plain error with both ways out', async () => {
    const { user } = renderPanel(NO_FOLLOWUP, {
      generateReply: () => rateLimitedReply({ 'Retry-After': '120' }),
    });

    await user.click(screen.getByRole('button', { name: 'Згенерувати фоллоу-ап' }));

    expect(await screen.findByText(OTHER_COPY)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Написати вручну' })).toBeDefined();
  });
});
