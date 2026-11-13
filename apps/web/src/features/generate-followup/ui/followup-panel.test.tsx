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
  followupJob,
  followupRoutes,
  NO_FOLLOWUP,
  READY_FOLLOWUP,
} from '@/test/followup-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { FollowupPanel } from './followup-panel';

type PanelSetup = Readonly<{ job?: AiJob; generateReply?: HttpResponseResolver }>;

const PROCESSING: AiJob = { status: 'processing', step: 2, steps: 3 };

const TIMEOUT_COPY =
  'Генерація не вдалася: модель не відповіла за 30 секунд. Твої дані нікуди не зникли.';

const OTHER_COPY = 'Генерація не вдалася. Твої дані нікуди не зникли.';

afterEach(() => {
  toast.dismiss();
});

function renderPanel(
  response: FollowupResponse,
  { job = PROCESSING, generateReply }: PanelSetup = {},
) {
  const routes = followupRoutes({ response, generateReply });
  server.use(...routes.handlers);
  const user = renderInApp(
    <FollowupPanel application={ACME_APPLICATION} followup={{ response, job }} />,
  );
  return { user, sent: routes.sent };
}

function draftFields() {
  return {
    subject: screen.getByRole<HTMLInputElement>('textbox', { name: 'Тема листа' }),
    body: screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Текст листа' }),
  };
}

describe('FollowupPanel', () => {
  it('before any draft offers tone, the vacancy language and a hint, and asks for a first draft', async () => {
    const { user, sent } = renderPanel({ ...NO_FOLLOWUP, language: 'en' });

    expect(screen.getByText(/AI напише драфт від твого імені/)).toBeDefined();
    expect(screen.getByRole('radio', { name: 'англійська' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      screen.getByText('Нотатки в модель не йдуть. Те, що варто згадати, напиши тут.'),
    ).toBeDefined();
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
    renderPanel(followupJob('queued'), { job: { status: 'queued', ahead: 2, etaSeconds: 30 } });

    expect(screen.getByText(/у черзі · 2 задачі перед твоєю/)).toBeDefined();
    expect(
      screen.getByText('Можеш закрити картку: повідомимо, коли драфт буде готовий.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Згенерувати фоллоу-ап' })).toBeNull();
  });

  it('a ready draft is editable and copies the edited subject and body together', async () => {
    const { user } = renderPanel(READY_FOLLOWUP);
    const { subject, body } = draftFields();

    expect(screen.getByText('драфт готовий · можна правити')).toBeDefined();
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

    await user.click(screen.getByRole('button', { name: 'Позначити надісланим' }));

    expect(await screen.findByText('Фоллоу-ап позначено надісланим')).toBeDefined();
    expect(sent.marked).toEqual([ACME_APPLICATION.id]);
  });

  it('a timed out draft shows the designed error, and «Написати самому» opens an empty editor', async () => {
    const { user } = renderPanel(followupJob('failed', 'ai_timeout'));

    expect(screen.getByText(TIMEOUT_COPY)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Спробувати ще' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Написати самому' }));

    const { subject, body } = draftFields();
    expect(subject.value).toBe('');
    expect(body.value).toBe('');
    expect(screen.queryByText(TIMEOUT_COPY)).toBeNull();
  });

  it('an empty own draft cannot be copied or marked sent until it has a body', async () => {
    const { user, sent } = renderPanel(followupJob('failed', 'ai_timeout'));
    await user.click(screen.getByRole('button', { name: 'Написати самому' }));
    const copy = screen.getByRole<HTMLButtonElement>('button', { name: 'Скопіювати' });
    const markSent = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Позначити надісланим',
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

  it('a refused request, such as the hourly AI limit, shows the plain error with both ways out', async () => {
    const { user } = renderPanel(NO_FOLLOWUP, {
      generateReply: () => rateLimitedReply({ 'Retry-After': '120' }),
    });

    await user.click(screen.getByRole('button', { name: 'Згенерувати фоллоу-ап' }));

    expect(await screen.findByText(OTHER_COPY)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Написати самому' })).toBeDefined();
  });
});
