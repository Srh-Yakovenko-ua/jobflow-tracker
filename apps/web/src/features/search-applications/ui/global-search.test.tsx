import type { ApplicationListItem, ApplicationListResponse } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FULL_CARD } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { push } from '@/test/navigation';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { GlobalSearch } from './global-search';

vi.mock('next/navigation', () => import('@/test/navigation'));

const SEARCH = uk.shell.search;

const TRIDENT_HIT: ApplicationListItem = { ...FULL_CARD, snippet: null };

const REJECTED_HIT: ApplicationListItem = {
  ...FULL_CARD,
  id: '0b6f3c1e-5d2a-4c8e-9f10-0000000000b2',
  company: 'Kvit Software',
  position: 'Full-stack Developer',
  currentStage: 'rejected',
  snippet: [
    { text: 'Event bus on ', match: false },
    { text: 'Kafka', match: true },
    { text: ' with Redis', match: false },
  ],
};

const HITS: ApplicationListResponse = { items: [TRIDENT_HIT, REJECTED_HIT], nextCursor: null };

const LIST_URL = apiUrl('/applications');

function answerWith(body: ApplicationListResponse) {
  const asked: URLSearchParams[] = [];
  server.use(
    http.get(LIST_URL, ({ request }) => {
      asked.push(new URL(request.url).searchParams);
      return HttpResponse.json(body);
    }),
  );
  return asked;
}

function renderSearch() {
  const user = renderInApp(
    <>
      <GlobalSearch />
      <input aria-label="notes" />
    </>,
  );
  return { user, field: screen.getByRole('combobox', { name: SEARCH.label }) };
}

async function typeQuery(query: string) {
  const rendered = renderSearch();
  await rendered.user.type(rendered.field, query);
  return rendered;
}

describe('GlobalSearch', () => {
  afterEach(() => {
    push.mockClear();
  });

  it('a slash outside a field focuses the search, a slash in another field stays typed there', async () => {
    const { user, field } = renderSearch();

    await user.keyboard('/');
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty('value', '');

    const notes = screen.getByRole('textbox', { name: 'notes' });
    await user.click(notes);
    await user.keyboard('/');

    expect(notes).toHaveProperty('value', '/');
    expect(document.activeElement).toBe(notes);
  });

  it('asks for the 8 most relevant matches and opens the hit picked with the arrows and Enter', async () => {
    const asked = answerWith(HITS);
    const { user, field } = await typeQuery('tri');

    await screen.findByRole('option', { name: /Kvit Software/ });
    await user.keyboard('{ArrowDown}{Enter}');

    expect(Object.fromEntries(asked.at(-1) ?? [])).toEqual({
      q: 'tri',
      limit: '8',
      sort: 'relevance',
    });
    expect(push).toHaveBeenCalledWith(`/applications/${REJECTED_HIT.id}`);
    expect(field).toHaveProperty('value', '');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('names the stage of every hit as text', async () => {
    answerWith(HITS);
    await typeQuery('so');

    const hit = await screen.findByRole('option', { name: /Kvit Software/ });

    expect(hit.textContent).toContain('відмова');
  });

  it('marks the matched word of a snippet and keeps the rest of it as plain text', async () => {
    answerWith(HITS);
    await typeQuery('kaf');

    const hit = await screen.findByRole('option', { name: /Kvit Software/ });

    expect(within(hit).getByText('Kafka').tagName).toBe('MARK');
    expect(within(hit).getByText(/Event bus on/).tagName).not.toBe('MARK');
    expect(hit.querySelectorAll('mark')).toHaveLength(1);
    expect(
      screen.getByRole('option', { name: /Trident Systems/ }).querySelector('mark'),
    ).toBeNull();
  });

  it('one letter keeps the results closed', async () => {
    const { field } = await typeQuery('t');

    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says there are no matches and keeps the query in the field', async () => {
    answerWith({ items: [], nextCursor: null });
    const { field } = await typeQuery('zzz');

    expect(await screen.findByText(uk.ui.noMatches)).not.toBeNull();
    expect(field).toHaveProperty('value', 'zzz');
  });

  it('a failed search is announced and retried from the keyboard', async () => {
    answerWith(HITS);
    server.use(
      http.get(LIST_URL, () => errorReply({ status: 422, type: 'validation_error' }), {
        once: true,
      }),
    );
    const { user } = await typeQuery('tri');

    expect((await screen.findByRole('alert')).textContent).toBe(SEARCH.error);
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('option', { name: /Trident Systems/ })).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the loading row while the search is slow', async () => {
    server.use(http.get(LIST_URL, () => delay('infinite')));
    await typeQuery('tri');

    expect((await screen.findByText(SEARCH.loading)).closest('[role="status"]')).not.toBeNull();
  });

  it('Escape closes the results, keeps the text and aria-expanded follows', async () => {
    answerWith(HITS);
    const { user, field } = await typeQuery('tri');
    expect(field.getAttribute('aria-expanded')).toBe('true');
    await screen.findByRole('option', { name: /Trident Systems/ });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field).toHaveProperty('value', 'tri');
    expect(document.activeElement).toBe(field);
  });
});
