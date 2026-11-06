import { NOTE_LIMITS } from '@jobflow/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS } from '@/shared/api';
import { OUTAGES, recordSentRequests } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import type { MoveRouteOptions } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { NOTE_ID, noteDeleteRoute, noteRoute, noteUpdateRoute } from '@/test/note-fixtures';
import { InApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { NoteEditor } from './note-editor';

const FAILED = 'не збережено, спробуємо ще';

const TYPED = 'abcdefghijklmno';

const AT_ONCE = { timeout: 100 } as const;

function renderEditor(added: MoveRouteOptions = {}) {
  const post = noteRoute(added);
  const patch = noteUpdateRoute();
  const removal = noteDeleteRoute();
  server.use(post.handler, patch.handler, removal.handler);
  const requests = recordSentRequests();
  const drafts: (string | null)[] = [];
  const onDraftChange = (noteId: string | null) => {
    drafts.push(noteId);
  };
  const view = render(<NoteEditor application={ACME_APPLICATION} actions={{ onDraftChange }} />, {
    wrapper: InApp,
  });
  return {
    user: userEvent.setup(),
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
  return { id: ACME_APPLICATION.id, body: { body } };
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
    }, AT_ONCE);
    expect(sentKinds()).toEqual(['POST true']);
  });

  it('closing the editor sends the text not yet saved at once, with keepalive, long before the timer', async () => {
    const { field, added, sentKinds, unmount } = renderEditor();
    fireEvent.change(field, { target: { value: 'Друга задача' } });

    unmount();

    await waitFor(() => {
      expect(added).toEqual([postOf('Друга задача')]);
    }, AT_ONCE);
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
    const { user, field, added, updated } = renderEditor({ latch: held });
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
    'when the API $name the status says it was not saved, keeps the text and shows no toast',
    async ({ reply, settled }) => {
      const { user, field } = renderEditor({ reply });
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
    },
  );

  it('after a refused save the next change sends the whole text again', async () => {
    const { user, field } = renderEditor({ reply: () => HttpResponse.error() });
    await user.type(field, 'Друга задача');
    pass(1000);
    await screen.findByText(FAILED);
    const retried = noteRoute();
    server.use(retried.handler);

    await user.type(field, ' і графи');
    pass(1000);

    await waitFor(() => {
      expect(retried.sent).toEqual([postOf('Друга задача і графи')]);
    });
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
    const { user, field, added, updated } = renderEditor({ latch: held });
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
});

describe('NoteEditor field', () => {
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
