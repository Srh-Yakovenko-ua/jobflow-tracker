import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { fixtureIdOf } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { NOTE_ID, noteOf, notesRoute } from '@/test/note-fixtures';
import { renderApplicationPage } from '@/test/render-application-page';
import { server } from '@/test/server';
import {
  DESIGN_NOTE,
  DESIGN_TIMELINE,
  EMPTY_TIMELINE,
  noteAddedOf,
  timelineRoute,
} from '@/test/timeline-fixtures';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const PRIVACY = 'Нотатки ніколи не йдуть у модель';

const PRIVACY_LABEL = 'Приватність нотаток';

const DRAFT_AT = '2026-10-20T10:00:00Z';

const XSS_BODY = '<img src=x onerror=alert(1)>';

const MODES = ['page', 'sheet'] as const;

const FIRST_SECOND = 'Друга з';

const SAVED_BODY = 'Друга задача';

type PageNotes = ReturnType<typeof renderApplicationPage>['notes'];

type AutosaveSetup = Readonly<{
  user: UserEvent;
  editor: HTMLTextAreaElement;
  notes: PageNotes;
  between?: () => Promise<void>;
}>;

const DESIGN_NOTES = [
  noteOf({
    id: fixtureIdOf(502),
    applicationId: ACME_APPLICATION.id,
    body: DESIGN_NOTE,
    createdAt: '2026-09-03T12:40:00Z',
  }),
  noteOf({
    id: fixtureIdOf(501),
    applicationId: ACME_APPLICATION.id,
    body: 'Рекрутерка просила **портфоліо**',
    createdAt: '2026-08-25T10:00:00Z',
  }),
];

async function findNotesSection(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Нотатки' });
}

function noteRows(section: HTMLElement): (string | null)[] {
  const list = within(section).queryByRole('list');
  if (list === null) return [];
  return within(list)
    .getAllByRole('listitem')
    .map((note) => note.textContent);
}

function editorIn(section: HTMLElement): HTMLTextAreaElement {
  return within(section).getByRole<HTMLTextAreaElement>('textbox', { name: 'Нова нотатка' });
}

function timelineSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Історія відгуку' });
}

function saveNow() {
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

function draftTimelineOf(body: string) {
  return { items: [noteAddedOf({ id: NOTE_ID, body, createdAt: DRAFT_AT })] };
}

function storedNoteTimeline({ added, updated }: PageNotes) {
  return () => {
    const stored = [...added, ...updated].at(-1);
    if (stored === undefined) return HttpResponse.json(EMPTY_TIMELINE);
    return HttpResponse.json(draftTimelineOf(stored.body.body));
  };
}

async function renderWithStoredTimeline() {
  fakeTimeouts();
  const page = renderApplicationPage();
  server.use(timelineRoute({ reply: storedNoteTimeline(page.notes) }));
  return { ...page, editor: editorIn(await findNotesSection()) };
}

async function autosaveTwice({ user, editor, notes, between }: AutosaveSetup) {
  await user.type(editor, FIRST_SECOND);
  saveNow();
  await screen.findByText('збережено');
  await between?.();
  await user.type(editor, 'адача');
  saveNow();
  await waitFor(() => {
    expect(notes.updated).toEqual([{ noteId: NOTE_ID, body: { body: SAVED_BODY } }]);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ApplicationNotes', () => {
  it.each(MODES)(
    'in %s mode lists the notes newest first as served, each under its date and stage, above the editor',
    async (mode) => {
      renderApplicationPage({ mode, notes: { items: DESIGN_NOTES }, timeline: DESIGN_TIMELINE });
      const section = await findNotesSection();

      await within(section).findByText("03.09, після техінтерв'ю");

      expect(noteRows(section)).toEqual([
        `03.09, після техінтерв'ю${DESIGN_NOTE}`,
        '25.08, після скринінгуРекрутерка просила портфоліо',
      ]);
      expect(within(section).getByText('портфоліо').tagName).toBe('STRONG');
      expect(editorIn(section)).toBeDefined();
    },
  );

  it('an XSS payload in a note is shown as its text and builds no image', async () => {
    const payload = noteOf({ applicationId: ACME_APPLICATION.id, body: XSS_BODY });
    renderApplicationPage({ notes: { items: [payload] } });
    const section = await findNotesSection();

    expect(await within(section).findByText(XSS_BODY)).toBeDefined();
    expect(section.querySelector('img, script, [onerror]')).toBeNull();
  });

  it('the lock button opens the sentence that notes never go to the model on a tap, read once', async () => {
    const { user } = renderApplicationPage();
    const section = await findNotesSection();
    const lock = within(section).getByRole('button', { name: PRIVACY_LABEL });
    expect(lock.hasAttribute('aria-describedby')).toBe(false);

    await user.click(lock);

    const privacy = await screen.findByRole('dialog', { name: PRIVACY_LABEL });
    expect(privacy.textContent).toBe(PRIVACY);
    expect(screen.getAllByText(PRIVACY)).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: PRIVACY_LABEL })).toBeNull();
    expect(document.activeElement).toBe(lock);
  });

  it('a saved draft stays out of the list while it is open, and Ctrl+Enter moves it into the list', async () => {
    fakeTimeouts();
    const { user, notes } = renderApplicationPage();
    const section = await findNotesSection();
    const editor = editorIn(section);
    await user.type(editor, 'Друга задача');
    saveNow();

    expect(await within(section).findByText('збережено')).toBeDefined();
    expect(notes.added).toHaveLength(1);
    expect(noteRows(section)).toEqual([]);
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(noteRows(section)).toEqual(['20.10Друга задача']);
    });
    expect(editor.value).toBe('');
  });

  it('the timeline never shows a draft body older than the saved one, and shows the note once Ctrl+Enter ends it', async () => {
    const { user, editor, notes } = await renderWithStoredTimeline();
    await autosaveTwice({ user, editor, notes });

    expect(within(timelineSection()).queryByText(FIRST_SECOND)).toBeNull();
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(await within(timelineSection()).findByText(SAVED_BODY)).toBeDefined();
  });

  it('a stage move brings the open draft into the timeline, and its row follows the next autosave while the timeline holds the older body', async () => {
    const { user, editor, notes } = await renderWithStoredTimeline();
    const moveOnce = async () => {
      await user.click(screen.getByRole('button', { name: 'Перенести у «фінал»' }));
      expect(await within(timelineSection()).findByText(FIRST_SECOND)).toBeDefined();
      server.use(timelineRoute({ timeline: draftTimelineOf(FIRST_SECOND) }));
    };

    await autosaveTwice({ user, editor, notes, between: moveOnce });

    expect(await within(timelineSection()).findByText(SAVED_BODY)).toBeDefined();
    expect(within(timelineSection()).queryByText(FIRST_SECOND)).toBeNull();
  });

  it('closing the application with an open draft shows its last saved body in the timeline when it opens again', async () => {
    const { user, editor, notes, reopen } = await renderWithStoredTimeline();
    await autosaveTwice({ user, editor, notes });

    reopen();

    expect(await within(timelineSection()).findByText(SAVED_BODY)).toBeDefined();
    expect(within(timelineSection()).queryByText(FIRST_SECOND)).toBeNull();
  });

  it('while the list loads the section is busy and the editor already takes text', async () => {
    renderApplicationPage({ notes: { latch: latch() } });
    const section = await findNotesSection();

    expect(section.getAttribute('aria-busy')).toBe('true');
    expect(editorIn(section).disabled).toBe(false);
  });

  it('a list that fails to load offers a retry in the section and keeps the editor', async () => {
    const { user } = renderApplicationPage({
      notes: { reply: () => errorReply({ status: 404, type: 'not_found' }) },
    });
    const section = await findNotesSection();
    const retry = await within(section).findByRole('button', { name: 'Спробувати ще раз' });
    expect(editorIn(section)).toBeDefined();
    server.use(notesRoute({ items: DESIGN_NOTES }).handler);

    await user.click(retry);

    expect(await within(section).findByText(DESIGN_NOTE)).toBeDefined();
    expect(noteRows(section)).toHaveLength(2);
  });
});
