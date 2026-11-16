import type { ApplicationResponse } from '@jobflow/shared';
import { buildDesignOffers, buildOfferList } from '@jobflow/shared/testing';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { applicationRoute } from '@/test/application-fixtures';
import { pagedListRoute } from '@/test/list-fixtures';
import { refuseStorage } from '@/test/refusing-storage';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { type Comparison, EMPTY_OFFER_NOTES, type OfferNotes } from '../model/comparison-store';
import { OfferComparison, type OfferComparisonProps } from './offer-comparison';

const MISSING = () => errorReply({ status: 404, type: 'not_found' });

const STORE_KEY = `jobflow.offer-compare.${ME_RESPONSE.user.id}`;

const DESIGN_OFFERS = buildDesignOffers(4);

const [TRIDENT = '', NORTHWIND = '', LUMEN = '', ORBIT = ''] = DESIGN_OFFERS.map(
  ({ company }) => company,
);

const SLIDERS = ['Гроші', 'Стек', 'Формат', 'Ріст', 'Стабільність'] as const;

const idOf = (index: number) => DESIGN_OFFERS[index]?.id ?? '';

const notesWith = (benefits: Partial<OfferNotes['benefits']>): OfferNotes => ({
  ...EMPTY_OFFER_NOTES,
  benefits: { ...EMPTY_OFFER_NOTES.benefits, ...benefits },
});

const STABILITY_FIRST = {
  weights: { money: 0, stack: 1, format: 0, growth: 0, stability: 5 },
  preferredMode: 'remote',
  offers: {
    [idOf(0)]: notesWith({ equipment: true, education: true, medical: true }),
    [idOf(2)]: notesWith({ equipment: true, education: true, medical: true, vacation: true }),
  },
} satisfies Comparison;

type ComparisonRender = Readonly<{
  offers: readonly ApplicationResponse[];
  view?: OfferComparisonProps['view'];
}>;

function renderComparison({ offers, view = { mode: 'screen' } }: ComparisonRender) {
  const list = pagedListRoute({ items: buildOfferList(offers).items });
  const reads = offers.map((application) => applicationRoute({ application }).handler);
  server.use(meRoute(), list.handler, ...reads);
  return renderViewInApp(<OfferComparison view={view} />);
}

async function rankedCompanies(): Promise<string[]> {
  const ranking = await screen.findByRole('region', { name: 'Офери за балом' });
  return within(ranking)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);
}

function columnOf(company: string) {
  return within(screen.getByRole('article', { name: company }));
}

function slider(name: (typeof SLIDERS)[number]): HTMLInputElement {
  const input = screen.getByRole('slider', { name });
  if (!(input instanceof HTMLInputElement)) throw new Error(`${name} is not a range input`);
  return input;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('OfferComparison', () => {
  it('ranks three offers by the default weights, each column with its rank, score, USD net, original range, mode, location and Match Score', async () => {
    renderComparison({ offers: buildDesignOffers(3) });

    expect(await rankedCompanies()).toEqual([TRIDENT, NORTHWIND, LUMEN]);
    const northwind = columnOf(NORTHWIND);
    expect(northwind.getByText('№2')).toBeDefined();
    expect(northwind.getByText('33')).toBeDefined();
    expect(northwind.getByText(/^\$3\s581 нетто на місяць$/)).toBeDefined();
    expect(northwind.getByText(/^€4\s000$/)).toBeDefined();
    expect(northwind.getByText('офіс')).toBeDefined();
    expect(northwind.getByText('Lviv')).toBeDefined();
    expect(northwind.getByRole('img', { name: 'Match Score 92' })).toBeDefined();
    const companyLink = northwind.getByRole('link', { name: NORTHWIND });
    expect(companyLink.getAttribute('href')).toBe(
      '/applications/0b6f3c1e-5d2a-4c8e-9f10-000000000502',
    );
    expect(companyLink.classList.contains('touch-target')).toBe(true);
    expect(columnOf(LUMEN).getByRole('img', { name: 'без CV' })).toBeDefined();
    expect(columnOf(TRIDENT).getByText('56')).toBeDefined();
    expect(screen.getByText('Перше місце: Trident Systems')).toBeDefined();
  });

  it('changing the weights reorders the offers at once: no money, all stack and no format puts Northwind first', async () => {
    renderComparison({ offers: buildDesignOffers(3) });
    await rankedCompanies();

    fireEvent.change(slider('Гроші'), { target: { value: '0' } });
    fireEvent.change(slider('Стек'), { target: { value: '5' } });
    fireEvent.change(slider('Формат'), { target: { value: '0' } });

    expect(await rankedCompanies()).toEqual([NORTHWIND, TRIDENT, LUMEN]);
    expect(columnOf(NORTHWIND).getByText('42')).toBeDefined();
    expect(columnOf(TRIDENT).getByText('36')).toBeDefined();
    expect(columnOf(LUMEN).getByText('0')).toBeDefined();
    expect(screen.getByText('Перше місце: Northwind Labs')).toBeDefined();
  });

  it('unticking a benefit drops its offer below the next one and keeps focus on that checkbox', async () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(STABILITY_FIRST));
    const { user } = renderComparison({ offers: buildDesignOffers(3) });
    expect(await rankedCompanies()).toEqual([LUMEN, TRIDENT, NORTHWIND]);
    const vacation = columnOf(LUMEN).getByRole('checkbox', { name: 'Оплачувана відпустка' });

    await user.click(vacation);

    expect(await rankedCompanies()).toEqual([TRIDENT, LUMEN, NORTHWIND]);
    expect(vacation.getAttribute('aria-checked')).toBe('false');
    expect(document.activeElement).toBe(vacation);
  });

  it('notes, benefits and weights come back from this device after the page opens again', async () => {
    const first = renderComparison({ offers: buildDesignOffers(2) });
    await rankedCompanies();
    await first.user.type(columnOf(TRIDENT).getByLabelText('Команда і продукт'), 'Сильна команда');
    await first.user.click(
      columnOf(TRIDENT).getByRole('checkbox', { name: 'Медичне страхування' }),
    );
    fireEvent.change(slider('Гроші'), { target: { value: '5' } });
    first.view.unmount();

    renderComparison({ offers: buildDesignOffers(2) });
    await rankedCompanies();

    const trident = columnOf(TRIDENT);
    expect(trident.getByLabelText('Команда і продукт')).toHaveProperty('value', 'Сильна команда');
    expect(
      trident.getByRole('checkbox', { name: 'Медичне страхування' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(slider('Гроші').value).toBe('5');
  });

  it('a storage that refuses access still shows the ranking with every weight at 3', async () => {
    refuseStorage();
    renderComparison({ offers: buildDesignOffers(3) });

    expect(await rankedCompanies()).toEqual([TRIDENT, NORTHWIND, LUMEN]);
    expect(SLIDERS.map((name) => slider(name).value)).toEqual(['3', '3', '3', '3', '3']);
  });

  it.each([2, 3, 4] as const)('%i offers give that many ranked columns', async (count) => {
    renderComparison({ offers: buildDesignOffers(count) });

    expect(await rankedCompanies()).toHaveLength(count);
    expect(screen.getAllByRole('article')).toHaveLength(count);
  });

  it('four offers put Orbit Health third: no salary reads as an unknown range and scores 0 on money', async () => {
    renderComparison({ offers: buildDesignOffers(4) });

    expect(await rankedCompanies()).toEqual([TRIDENT, NORTHWIND, ORBIT, LUMEN]);
    expect(columnOf(ORBIT).getByText('вилка не вказана')).toBeDefined();
    expect(columnOf(ORBIT).getByText('32')).toBeDefined();
  });

  it.each([
    { count: 0, title: 'Бракує ще 2 оферів' },
    { count: 1, title: 'Бракує ще 1 офера' },
  ])('$count offers show how many are missing and a way to the board', async ({ count, title }) => {
    renderComparison({ offers: buildDesignOffers(2).slice(0, count) });

    expect(await screen.findByRole('heading', { name: title })).toBeDefined();
    expect(screen.getByRole('link', { name: 'До дошки' }).getAttribute('href')).toBe('/board');
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('a failed offer read shows the error, and its retry brings the offers in', async () => {
    const [trident, northwind] = buildDesignOffers(2);
    if (!trident || !northwind) throw new Error('the design offers lost an offer');
    const { user } = renderComparison({ offers: [trident, northwind] });
    server.use(applicationRoute({ application: northwind, reply: MISSING }).handler);

    const failed = await screen.findByRole('alert');
    server.use(applicationRoute({ application: northwind }).handler);
    await user.click(within(failed).getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await rankedCompanies()).toEqual([TRIDENT, NORTHWIND]);
  });

  it('the print view lists the same ranking read-only with the weights as text and opens the print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    localStorage.setItem(STORE_KEY, JSON.stringify(STABILITY_FIRST));
    const { user } = renderComparison({ offers: buildDesignOffers(3), view: { mode: 'print' } });

    expect(await rankedCompanies()).toEqual([LUMEN, TRIDENT, NORTHWIND]);
    expect(screen.getByText('Стабільність: 5 з 5')).toBeDefined();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(columnOf(LUMEN).getByText('Оплачувана відпустка')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Друкувати' }));

    expect(print).toHaveBeenCalledTimes(1);
  });
});
