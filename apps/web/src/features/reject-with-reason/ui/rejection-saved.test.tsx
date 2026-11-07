import {
  type RejectionReasonCode,
  type RejectionReasonsSummary,
  STAGE_MOVE_LIMITS,
} from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { notesQueryOptions } from '@/entities/note';
import { ANY_IDEMPOTENCY_KEY, errorReply, OUTAGES, validationReply } from '@/test/api-handlers';
import {
  type MoveRouteOptions,
  reasonsSummaryRoute,
  type ReasonsSummaryRouteOptions,
} from '@/test/board-fixtures';
import { descriptionOf } from '@/test/field-description';
import { noteRoute, notesRoute } from '@/test/note-fixtures';
import { QueryProbe, StaleQuery, waitForQuery } from '@/test/query-status';
import { ACME_TECH_INTERVIEW, recordedRejectionActions } from '@/test/rejection-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import type { RejectionStep } from '../model/rejection-step';
import { RejectionReasonDialog } from './rejection-reason-dialog';

const SUMMARY_KEY = applicationKeys.reasonsSummary('tech_interview');

const SAVED_TITLE = 'Acme Technologies → відмова: не вистачає скілів';

const LIVE_CODING_NOTE = {
  id: ACME_TECH_INTERVIEW.id,
  body: { body: 'Попросили live coding 3' },
  idempotencyKey: ANY_IDEMPOTENCY_KEY,
};

const EARLIER_SUMMARY: RejectionReasonsSummary = {
  stage: 'tech_interview',
  total: 5,
  reasons: [
    { code: 'skills_gap', count: 3 },
    { code: 'chose_other', count: 2 },
  ],
};

type StepSetup = {
  summary?: ReasonsSummaryRouteOptions | undefined;
  cached?: RejectionReasonsSummary | undefined;
  beside?: ReactNode;
};

type SavedSetup = StepSetup & {
  reasonCode?: RejectionReasonCode;
  undoUntil?: number;
};

type InsightCase = {
  name: string;
  reasons: NonNullable<ReasonsSummaryRouteOptions['reasons']>;
  insight: string | null;
  bar: string[];
};

const INSIGHT_CASES: readonly InsightCase[] = [
  {
    name: '2 rejections give no claim and no bar',
    reasons: [{ code: 'skills_gap', count: 2 }],
    insight: null,
    bar: [],
  },
  {
    name: '4 rejections give no claim and no bar',
    reasons: [
      { code: 'skills_gap', count: 3 },
      { code: 'chose_other', count: 1 },
    ],
    insight: null,
    bar: [],
  },
  {
    name: '5 rejections with the picked reason on top say it became the most frequent',
    reasons: [
      { code: 'skills_gap', count: 3 },
      { code: 'chose_other', count: 2 },
    ],
    insight:
      "Відмов на етапі «техінтерв'ю»: 5. Причина «не вистачає скілів» стала найчастішою на цьому етапі.",
    bar: ['не вистачає скілів3', 'обрали іншого2'],
  },
  {
    name: '5 rejections with a tie on top count them and make no claim',
    reasons: [
      { code: 'chose_other', count: 2 },
      { code: 'skills_gap', count: 2 },
      { code: 'low_salary', count: 1 },
    ],
    insight: "Відмов на етапі «техінтерв'ю»: 5.",
    bar: ['обрали іншого2', 'не вистачає скілів2', 'низька вилка1'],
  },
];

function ShownNotes() {
  useQuery(notesQueryOptions(ACME_TECH_INTERVIEW.id));
  return null;
}

function renderStep(step: RejectionStep, { summary, cached, beside }: StepSetup = {}) {
  const route = reasonsSummaryRoute(summary);
  server.use(route.handler);
  const { actions, ...recorded } = recordedRejectionActions();
  const user = renderInApp(
    <>
      {cached && <StaleQuery queryKey={SUMMARY_KEY} data={cached} />}
      <RejectionReasonDialog
        prompt={{ application: ACME_TECH_INTERVIEW, step }}
        actions={actions}
      />
      <QueryProbe queryKey={SUMMARY_KEY} />
      {beside}
    </>,
  );
  return { user, ...recorded, asked: route.sent };
}

function renderSaved({ reasonCode = 'skills_gap', undoUntil, ...setup }: SavedSetup = {}) {
  const until = undoUntil ?? Date.now() + STAGE_MOVE_LIMITS.undoWindowMs;
  return renderStep({ kind: 'saved', reasonCode, undoUntil: until }, setup);
}

async function submitNote(control: MoveRouteOptions = {}) {
  const notes = noteRoute(control);
  server.use(notes.handler);
  const step = renderStep({ kind: 'note' });
  await step.user.type(screen.getByLabelText("Що варто запам'ятати"), 'Попросили live coding 3');
  await step.user.click(screen.getByRole('button', { name: 'Зберегти' }));
  return { ...step, sent: notes.sent };
}

function barRows(): string[] {
  const bar = screen.queryByRole('list');
  return bar === null
    ? []
    : within(bar)
        .getAllByRole('listitem')
        .map((row) => row.textContent);
}

function expectRecordedOnly() {
  expect(screen.getByText('записано в аналітику')).toBeDefined();
  expect(screen.getByRole('dialog', { name: SAVED_TITLE })).toBeDefined();
  expect(screen.queryByText(/найчастіш/)).toBeNull();
  expect(screen.queryByRole('list')).toBeNull();
}

afterEach(() => {
  toast.dismiss();
});

describe('RejectionReasonDialog, saved step', () => {
  it.each(INSIGHT_CASES)('$name', async ({ reasons, insight, bar }) => {
    const { asked } = renderSaved({ summary: { reasons } });

    await waitForQuery({ queryKey: SUMMARY_KEY, status: 'success' });

    expect(asked).toEqual(['tech_interview']);
    expect(screen.getByText('записано в аналітику')).toBeDefined();
    expect(screen.getByRole('dialog', { name: SAVED_TITLE })).toBeDefined();
    expect(screen.queryByText(/^Відмов на етапі/)?.textContent ?? null).toBe(insight);
    expect(barRows()).toEqual(bar);
    expect(screen.queryAllByText("причини відмов на техінтерв'ю")).toHaveLength(
      bar.length > 0 ? 1 : 0,
    );
  });

  it('unspecified is recorded under a title with no reason', async () => {
    renderSaved({ reasonCode: 'unspecified' });

    await waitForQuery({ queryKey: SUMMARY_KEY, status: 'success' });

    expect(screen.getByRole('dialog', { name: 'Acme Technologies → відмова' })).toBeDefined();
  });

  it.each(OUTAGES)(
    'when the summary $name the step still shows what was recorded and undo still works',
    async ({ reply, settled }) => {
      const { user, finished } = renderSaved({ summary: { reply } });

      await waitForQuery({ queryKey: SUMMARY_KEY, status: settled });

      expectRecordedOnly();
      expect(screen.getByRole('button', { name: 'Готово' })).toBeDefined();
      expect(toast.getToasts()).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Скасувати перенос' }));
      expect(finished).toEqual(['undo']);
    },
  );

  it('a summary cached by an earlier rejection is not shown while it refreshes, nor after the refresh fails', async () => {
    renderSaved({
      cached: EARLIER_SUMMARY,
      summary: { reply: () => errorReply({ status: 500, type: 'internal_error' }) },
    });

    expectRecordedOnly();
    await waitForQuery({ queryKey: SUMMARY_KEY, status: 'error' });

    expectRecordedOnly();
  });

  it('once the undo window has passed there is no «Скасувати перенос»', async () => {
    renderSaved({ undoUntil: 0 });

    await waitForQuery({ queryKey: SUMMARY_KEY, status: 'success' });

    expect(screen.queryByRole('button', { name: 'Скасувати перенос' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Готово' })).toBeDefined();
  });

  it.each([
    { button: 'Скасувати перенос', action: 'undo' },
    { button: 'Додати нотатку', action: 'note' },
    { button: 'Готово', action: 'done' },
  ])('«$button» calls $action', async ({ button, action }) => {
    const { user, finished } = renderSaved();

    await user.click(screen.getByRole('button', { name: button }));

    expect(finished).toEqual([action]);
  });

  it('Escape keeps the move and acts as «Готово», and digits pick nothing', async () => {
    const { user, picked, finished } = renderSaved();

    await user.keyboard('3');
    await user.keyboard('{Escape}');

    expect(picked).toEqual([]);
    expect(finished).toEqual(['done']);
  });
});

describe('RejectionReasonDialog, note step', () => {
  it('a note is saved for the application, then the dialog closes with a success toast', async () => {
    const { finished, sent } = await submitNote();

    expect(await screen.findByText('Нотатку збережено')).toBeDefined();
    expect(sent).toEqual([LIVE_CODING_NOTE]);
    expect(finished).toEqual(['done']);
  });

  it('a save that failed and is sent again with the same text carries the key of the first try', async () => {
    const failed = await submitNote({
      reply: () => errorReply({ status: 500, type: 'internal_error' }),
    });
    expect(await screen.findByText('Не вдалося зберегти')).toBeDefined();
    const retried = noteRoute();
    server.use(retried.handler);

    await failed.user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('Нотатку збережено')).toBeDefined();
    expect(failed.sent).toEqual([LIVE_CODING_NOTE]);
    expect(retried.sent).toEqual(failed.sent);
    expect(failed.finished).toEqual(['done']);
  });

  it('a second save with the same text after a saved note carries a new key', async () => {
    const { user, sent } = await submitNote();
    expect(await screen.findByText('Нотатку збережено')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => {
      expect(sent).toEqual([LIVE_CODING_NOTE, LIVE_CODING_NOTE]);
    });
    expect(new Set(sent.map(({ idempotencyKey }) => idempotencyKey)).size).toBe(2);
  });

  it('a note the server refuses shows the reason at its field and the dialog stays open', async () => {
    const { finished, sent } = await submitNote({
      reply: () => validationReply([{ path: 'body', message: 'Note must not be blank' }]),
    });
    const note = screen.getByLabelText("Що варто запам'ятати");

    await waitFor(() => {
      expect(note.getAttribute('aria-invalid')).toBe('true');
    });
    expect(descriptionOf(note)).toBe('Note must not be blank');
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(sent).toEqual([LIVE_CODING_NOTE]);
    expect(finished).toEqual([]);
  });

  it('a saved note reloads the notes list the application page shows', async () => {
    const notes = noteRoute();
    const shown = notesRoute();
    server.use(notes.handler, shown.handler);
    const { user } = renderStep({ kind: 'note' }, { beside: <ShownNotes /> });
    await waitFor(() => {
      expect(shown.sent).toEqual([ACME_TECH_INTERVIEW.id]);
    });

    await user.type(screen.getByLabelText("Що варто запам'ятати"), 'Попросили live coding 3');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => {
      expect(shown.sent).toEqual([ACME_TECH_INTERVIEW.id, ACME_TECH_INTERVIEW.id]);
    });
  });

  it('an empty note is refused at its field and nothing is sent', async () => {
    const notes = noteRoute();
    server.use(notes.handler);
    const { user, finished } = renderStep({ kind: 'note' });

    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('Напиши хоча б кілька слів')).toBeDefined();
    expect(notes.sent).toEqual([]);
    expect(finished).toEqual([]);
  });

  it('Escape closes the note without saving', async () => {
    const notes = noteRoute();
    server.use(notes.handler);
    const { user, finished } = renderStep({ kind: 'note' });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(finished).toEqual(['done']);
    });
    expect(notes.sent).toEqual([]);
  });
});
