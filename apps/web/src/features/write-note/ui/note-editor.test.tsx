import { NOTE_LIMITS } from '@jobflow/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS } from '@/shared/api';
import { ANY_IDEMPOTENCY_KEY, OUTAGES, recordSentRequests } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import type { MoveRouteOptions } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { NOTE_ID, noteDeleteRoute, noteRoute, noteUpdateRoute } from '@/test/note-fixtures';
import { InApp, renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { NOTE_DRAFT_LIMITS } from '../model/use-note-draft';
import { NoteEditor } from './note-editor';

const FAILED = 'не збережено, спробуємо ще';

const TYPED = 'abcdefghijklmno';

const SECOND_SAVE = 'Друга задача, здався';

const LATER_TEXT = 'Друга задача, здався на 20 хв';

const BEFORE_THE_TIMER = { timeout: NOTE_DRAFT_LIMITS.saveAfterMs / 2 } as const;

type EditorRoutes = Readonly<{ added?: MoveRouteOptions; updated?: MoveRouteOptions }>;

function renderEditor({ added, updated }: EditorRoutes = {}) {
  const post = noteRoute(added);
  const patch = noteUpdateRoute(updated);
  const removal = noteDeleteRoute();
  server.use(post.handler, patch.handler, removal.handler);
  const requests = recordSentRequests();
  const drafts: (string | null)[] = [];
  const onDraftChange = (noteId: string | null) => {
    drafts.push(noteId);
  };
  const { user, view } = renderViewInApp(
    <NoteEditor application={ACME_APPLICATION} actions={{ onDraftChange }} />,
  );
  return {
    user,
    unmount: view.unmount,
    field: screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Нова нотатка' }),
    drafts,
    added: post.sent,
    updated: patch.sent,
    deleted: removal.sent,
    sentKinds: () =>
      requests().map(({ method, keepalive }) => `${String(method)} ${String(keepalive)}`),
  };
}

function postOf(body: string) {
  return { id: ACME_APPLICATION.id, body: { body }, idempotencyKey: ANY_IDEMPOTENCY_KEY };
}

function patchOf(body: string) {
  return { noteId: NOTE_ID, body: { body } };
}

function pass(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function statusText(): string | null {
  return screen.getByRole('status').textContent;
}

async function afterRefusedFirstSave() {
  const editor = renderEditor({ added: { reply: () => HttpResponse.error() } });
  await editor.user.type(editor.field, 'Друга задача');
  pass(1000);
  await screen.findByText(FAILED);
  const retried = noteRoute();
  server.use(retried.handler);
  return { ...editor, retried };
}

async function whileSecondSaveIsHeld() {
  const held = latch();
  const editor = renderEditor({ updated: { latch: held } });
  await editor.user.type(editor.field, 'Друга задача');
  pass(1000);
  await waitFor(() => {
    expect(editor.drafts).toEqual([NOTE_ID]);
  });
  await editor.user.type(editor.field, ', здався');
  pass(1000);
  await waitFor(() => {
    expect(editor.updated).toEqual([patchOf(SECOND_SAVE)]);
  });
  return { ...editor, held };
}

beforeEach(fakeTimeouts);

afterEach(() => {
  toast.dismiss();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('NoteEditor autosave', () => {
  it('a key every 200 ms for 3 s saves each second with the text typed so far: one POST at 1 s, then a PATCH each second', async () => {
    const { field, added, updated, sentKinds } = renderEditor();

    for (const [index] of Array.from(TYPED).entries()) {
      fireEvent.change(field, { target: { value: TYPED.slice(0, index + 1) } });
      await act(() => vi.advanceTimersByTimeAsync(200));
    }

    await waitFor(() => {
      expect(updated).toEqual([patchOf('abcdefghij'), patchOf('abcdefghijklmno')]);
    });
    expect(added).toEqual([postOf('abcde')]);
    expect(sentKinds()).toEqual(['POST true', 'PATCH true', 'PATCH true']);
    expect(statusText()).toBe('збережено');
  });

  it('pagehide sends the text not yet saved at once, with keepalive, long before the timer', async () => {
    const { field, added, sentKinds } = renderEditor();
    fireEvent.change(field, { target: { value: 'Друга задача' } });

    window.dispatchEvent(new Event('pagehide'));

    await waitFor(() => {
      expect(added).toEqual([postOf('Друга задача')]);
    }, BEFORE_THE_TIMER);
    expect(sentKinds()).toEqual(['POST true']);
  });

  it('pagehide while a PATCH is held sends the later text at once beside it, with keepalive', async () => {
    const { user, field, updated, sentKinds, held } = await whileSecondSaveIsHeld();
    await user.type(field, ' на 20 хв');

    window.dispatchEvent(new Event('pagehide'));

    await waitFor(() => {
      expect(updated).toEqual([patchOf(SECOND_SAVE), patchOf(LATER_TEXT)]);
    }, BEFORE_THE_TIMER);
    expect(sentKinds()).toEqual(['POST true', 'PATCH true', 'PATCH true']);
    held.release();
    expect(await screen.findByText('збережено')).toBeDefined();
  });

  it('a held PATCH that answers after the pagehide one is followed by the latest text again on the timer', async () => {
    const { user, field, held } = await whileSecondSaveIsHeld();
    const answered = noteUpdateRoute();
    server.use(answered.handler);
    await user.type(field, ' на 20 хв');
    window.dispatchEvent(new Event('pagehide'));
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.settledResults.at(-1)?.type).toBe('fulfilled');
    });

    held.release();
    await screen.findByText('збережено');
    pass(NOTE_DRAFT_LIMITS.saveAfterMs);

    await waitFor(() => {
      expect(answered.sent).toEqual([patchOf(LATER_TEXT), patchOf(LATER_TEXT)]);
    });
  });

  it('the tab going hidden sends the text not yet saved at once, with keepalive, long before the timer', async () => {
    const { field, added, sentKinds } = renderEditor();
    fireEvent.change(field, { target: { value: 'Друга задача' } });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(sentKinds()).toEqual(['POST true']);
    }, BEFORE_THE_TIMER);
    expect(added).toEqual([postOf('Друга задача')]);
  });

  it('the tab coming back into view sends nothing before the timer', async () => {
    const { field, sentKinds } = renderEditor();
    fireEvent.change(field, { target: { value: 'Друга задача' } });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    document.dispatchEvent(new Event('visibilitychange'));
    await act(() => vi.advanceTimersByTimeAsync(BEFORE_THE_TIMER.timeout));

    expect(sentKinds()).toEqual([]);
    pass(NOTE_DRAFT_LIMITS.saveAfterMs);
    expect(await screen.findByText('збережено')).toBeDefined();
  });

  it('closing the editor sends the text not yet saved at once, with keepalive, long before the timer', async () => {
    const { field, added, sentKinds, unmount } = renderEditor();
    fireEvent.change(field, { target: { value: 'Друга задача' } });

    unmount();

    await waitFor(() => {
      expect(added).toEqual([postOf('Друга задача')]);
    }, BEFORE_THE_TIMER);
    expect(sentKinds()).toEqual(['POST true']);
  });

  it('an untouched editor mounted twice by StrictMode says nothing about saving and sends nothing', async () => {
    const requests = recordSentRequests();
    render(<NoteEditor application={ACME_APPLICATION} actions={{ onDraftChange: vi.fn() }} />, {
      wrapper: InApp,
      reactStrictMode: true,
    });

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(statusText()).toBe('');
    expect(requests()).toEqual([]);
  });

  it('typing again while the first POST is held gives exactly one POST, then one PATCH', async () => {
    const held = latch();
    const { user, field, added, updated } = renderEditor({ added: { latch: held } });
    await user.type(field, 'Друга задача');
    pass(1000);
    await waitFor(() => {
      expect(added).toHaveLength(1);
    });

    await user.type(field, ', здався на 20 хв');
    pass(1000);
    expect(statusText()).toBe('зберігаю…');
    held.release();

    await waitFor(() => {
      expect(updated).toEqual([patchOf('Друга задача, здався на 20 хв')]);
    });
    expect(added).toEqual([postOf('Друга задача')]);
  });

  it.each(OUTAGES)(
    'when the API $name the status says it was not saved, keeps the text, shows no toast, and closing resends that POST with its key',
    async ({ reply, settled }) => {
      const { user, field, added, unmount } = renderEditor({ added: { reply } });
      await user.type(field, 'Друга задача');
      pass(1000);
      if (settled === 'pending') {
        await waitFor(() => {
          expect(statusText()).toBe('зберігаю…');
        });
        pass(API_CLIENT_LIMITS.requestTimeoutMs);
      }

      expect(await screen.findByText(FAILED)).toBeDefined();
      expect(field.value).toBe('Друга задача');
      expect(toast.getToasts()).toEqual([]);

      unmount();

      await waitFor(() => {
        expect(added).toEqual([postOf('Друга задача'), added[0]]);
      });
    },
  );

  it('after a refused first save and no more typing, the save timer resends that POST with its key and text', async () => {
    const { added, retried } = await afterRefusedFirstSave();

    pass(1000);

    await waitFor(() => {
      expect(retried.sent).toHaveLength(1);
    });
    expect(retried.sent).toEqual(added);
    expect(added).toEqual([postOf('Друга задача')]);
    expect(await screen.findByText('збережено')).toBeDefined();
  });

  it('after a refused first save the next autosave resends that POST with its key and text, then PATCHes the latest text', async () => {
    const { user, field, added, updated, drafts, retried } = await afterRefusedFirstSave();

    await user.type(field, ' і графи');
    pass(1000);

    await waitFor(() => {
      expect(updated).toEqual([patchOf('Друга задача і графи')]);
    });
    expect(added).toEqual([postOf('Друга задача')]);
    expect(retried.sent).toEqual(added);
    expect(drafts).toEqual([NOTE_ID]);
    expect(await screen.findByText('збережено')).toBeDefined();
  });

  it('a draft cleared to blank after its create is deleted, and whitespace alone is never sent', async () => {
    const { user, field, added, deleted, drafts, sentKinds } = renderEditor();
    await user.type(field, 'Друга задача');
    pass(1000);
    await waitFor(() => {
      expect(drafts).toEqual([NOTE_ID]);
    });

    await user.clear(field);
    await user.type(field, '   ');
    pass(1000);

    await waitFor(() => {
      expect(deleted).toEqual([NOTE_ID]);
    });
    expect(drafts).toEqual([NOTE_ID, null]);
    await user.type(field, 'a');
    pass(1000);
    await waitFor(() => {
      expect(added).toEqual([postOf('Друга задача'), postOf('   a')]);
    });
    expect(sentKinds()).toEqual(['POST true', 'DELETE true', 'POST true']);
  });
});

describe('NoteEditor finish', () => {
  it.each(['Control', 'Meta'])(
    '%s+Enter saves the note, empties the editor and starts the next note as a new one',
    async (modifier) => {
      const { user, field, added, updated, drafts } = renderEditor();
      await user.type(field, 'Друга задача');

      await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);

      await waitFor(() => {
        expect(field.value).toBe('');
      });
      expect(added).toEqual([postOf('Друга задача')]);
      expect(drafts).toEqual([NOTE_ID, null]);
      expect(statusText()).toBe('збережено');
      await user.type(field, 'Тимлід норм');
      await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);
      await waitFor(() => {
        expect(added).toEqual([postOf('Друга задача'), postOf('Тимлід норм')]);
      });
      expect(updated).toEqual([]);
    },
  );

  it('a second Ctrl+Enter while the first finish is held still makes one note and empties the editor', async () => {
    const held = latch();
    const { user, field, added, updated } = renderEditor({ added: { latch: held } });
    await user.type(field, 'Друга задача');

    await user.keyboard('{Control>}{Enter}{/Control}{Control>}{Enter}{/Control}');
    await waitFor(() => {
      expect(added).toHaveLength(1);
    });
    held.release();

    await waitFor(() => {
      expect(statusText()).toBe('збережено');
    });
    expect(field.value).toBe('');
    expect(added).toEqual([postOf('Друга задача')]);
    expect(updated).toEqual([]);
  });

  it('a PATCH sent while the tab was hidden that answers after Ctrl+Enter keeps the finished note and starts the next note as a new one', async () => {
    const { user, field, added, deleted, drafts, held } = await whileSecondSaveIsHeld();
    const besideHeld = latch();
    const beside = noteUpdateRoute({ latch: besideHeld });
    server.use(beside.handler);
    await user.type(field, ' на 20 хв');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => {
      expect(beside.sent).toEqual([patchOf(LATER_TEXT)]);
    }, BEFORE_THE_TIMER);
    const finished = noteUpdateRoute();
    server.use(finished.handler);

    await user.keyboard('{Control>}{Enter}{/Control}');
    held.release();
    await waitFor(() => {
      expect(field.value).toBe('');
    });
    besideHeld.release();
    await act(() => vi.advanceTimersByTimeAsync(NOTE_DRAFT_LIMITS.saveAfterMs));
    await user.type(field, 'Тимлід норм');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(added).toEqual([postOf('Друга задача'), postOf('Тимлід норм')]);
    });
    expect(finished.sent).toEqual([patchOf(LATER_TEXT)]);
    expect(deleted).toEqual([]);
    expect(drafts).toEqual([NOTE_ID, null, NOTE_ID, null]);
  });
});

describe('NoteEditor field', () => {
  it.each([
    { name: 'as a browser edit', prepare: () => undefined },
    {
      name: 'when the browser refuses insertText',
      prepare: () => vi.spyOn(document, 'execCommand').mockReturnValue(false),
    },
  ])('Ctrl+B $name hands the wrapped text to the draft save', async ({ prepare }) => {
    prepare();
    const { user, field, added } = renderEditor();
    await user.type(field, 'Треба DP');
    field.setSelectionRange(6, 8);

    await user.keyboard('{Control>}b{/Control}');
    pass(1000);

    await waitFor(() => {
      expect(added).toEqual([postOf('Треба **DP**')]);
    });
    expect(field.selectionEnd).toBe(10);
  });

  it('counts characters against the shared limit, caps the field there and names the finish key', async () => {
    const { user, field } = renderEditor();

    await user.type(field, 'Друга задача');

    expect(screen.getByText(`12 / ${String(NOTE_LIMITS.bodyMaxLength)}`)).toBeDefined();
    expect(field.maxLength).toBe(NOTE_LIMITS.bodyMaxLength);
    expect(field.placeholder).toBe('Додати нотатку…');
    expect(screen.getByText('Ctrl+Enter, щоб завершити')).toBeDefined();
  });

  it('Ctrl+B wraps the selection in ** and keeps it selected', async () => {
    const { user, field } = renderEditor();
    await user.type(field, 'Треба DP');
    field.setSelectionRange(6, 8);

    await user.keyboard('{Control>}b{/Control}');

    expect(field.value).toBe('Треба **DP**');
    expect([field.selectionStart, field.selectionEnd]).toEqual([8, 10]);
  });

  it('Enter continues a dash list and Enter on the empty item ends it', async () => {
    const { user, field } = renderEditor();

    await user.type(field, '- DP{Enter}');
    expect(field.value).toBe('- DP\n- ');
    await user.keyboard('{Enter}');

    expect(field.value).toBe('- DP\n');
  });
});
