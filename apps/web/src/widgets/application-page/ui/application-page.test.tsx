import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION, applicationRoute } from '@/test/application-fixtures';
import { findApplicationTitle, renderApplicationPage } from '@/test/render-application-page';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const RETRY_WAIT = { timeout: 2500 } as const;

describe('ApplicationPage', () => {
  it('shows the stage, the days in it, the company, the salary, the place and the whole stack', async () => {
    renderApplicationPage();

    expect(await findApplicationTitle()).toBeDefined();
    expect(screen.getByText("техінтерв'ю")).toBeDefined();
    expect(screen.getByText('9 днів на етапі')).toBeDefined();
    expect(screen.getByText('створено 12.10')).toBeDefined();
    expect(screen.getByText('Acme Technologies')).toBeDefined();
    expect(screen.getByText(/^\$4\s500–6\s000$/)).toBeDefined();
    expect(screen.getByText('Kyiv / гібрид')).toBeDefined();
    const stack = within(screen.getByRole('list', { name: 'Стек' })).getAllByRole('listitem');
    expect(stack.map((chip) => chip.textContent)).toEqual([
      'React',
      'TypeScript',
      'Next.js',
      'GraphQL',
      'Vitest',
    ]);
  });

  it('a click on the title opens the editor while the title, the meta line and the stack fold away out of reach', async () => {
    renderApplicationPage();
    const title = await screen.findByRole('button', { name: ACME_APPLICATION.position });

    fireEvent.click(title);

    const folding = [
      title,
      screen.getByText('Acme Technologies'),
      screen.getByRole('list', { name: 'Стек' }),
    ];
    for (const part of folding) {
      expect(part.closest('[inert]')).toBeInstanceOf(HTMLElement);
    }
    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Стек' })).toBeNull();
    });
    expect(
      screen.getByRole('heading', { level: 1, name: ACME_APPLICATION.position }),
    ).toBeDefined();
  });

  it('leads back to the board from the top bar', async () => {
    renderApplicationPage();

    await findApplicationTitle();
    expect(screen.getByRole('link', { name: 'Дошка' }).getAttribute('href')).toBe('/board');
  });

  it('drops the salary, the work mode and the stack an application does not have', async () => {
    renderApplicationPage({
      application: {
        ...ACME_APPLICATION,
        salaryMin: null,
        salaryMax: null,
        currency: null,
        workMode: null,
        stack: [],
      },
    });

    await findApplicationTitle();
    expect(screen.getByText('Kyiv')).toBeDefined();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Стек' })).toBeNull();
  });

  it('shows the not-found state with a way to the board when the API answers 404', async () => {
    renderApplicationPage({ reply: () => errorReply({ status: 404, type: 'not_found' }) });

    expect(await screen.findByRole('link', { name: 'На дошку' })).toBeDefined();
    expect(screen.queryByText(ACME_APPLICATION.position)).toBeNull();
  });

  it('shows the not-found state for an id that is not a uuid and asks the API nothing', async () => {
    const sent: string[] = [];
    server.use(
      http.get(apiUrl('/applications/not-a-uuid'), () => {
        sent.push('not-a-uuid');
        return HttpResponse.json(ACME_APPLICATION);
      }),
    );
    renderApplicationPage({ id: 'not-a-uuid' });

    expect(await screen.findByRole('link', { name: 'На дошку' })).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('offers a retry after a failed load, and the retry shows the application', async () => {
    const { user, sent } = renderApplicationPage({
      reply: () => errorReply({ status: 500, type: 'internal_error' }),
    });

    const retry = await screen.findByRole('button', { name: 'Спробувати ще раз' }, RETRY_WAIT);
    expect(sent).toHaveLength(2);
    server.use(applicationRoute({ application: ACME_APPLICATION }).handler);
    await user.click(retry);

    expect(await findApplicationTitle()).toBeDefined();
  });
});
