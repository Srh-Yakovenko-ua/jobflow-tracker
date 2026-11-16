import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { comparisonSchema } from './comparison-store';
import { useComparisonStore } from './use-comparison-store';

const STORE_KEY = `jobflow.offer-compare.${ME_RESPONSE.user.id}`;

const [KEPT, ADDED, WITHDRAWN] = [fixtureIdOf(501), fixtureIdOf(502), fixtureIdOf(599)];

const TICKED_NOTES = {
  notes: 'Сильна команда',
  growthNote: '',
  growthRating: 4,
  benefits: { equipment: true, education: false, medical: true, vacation: false },
};

const STORED = {
  weights: { money: 5, stack: 1, format: 0, growth: 2, stability: 4 },
  preferredMode: 'office',
  offers: { [KEPT]: TICKED_NOTES, [WITHDRAWN]: TICKED_NOTES },
};

afterEach(() => {
  localStorage.clear();
});

async function renderStore() {
  server.use(meRoute());
  const { result } = renderHookInApp(() => useComparisonStore([KEPT, ADDED]));
  await waitFor(() => {
    expect(result.current.ready).toBe(true);
  });
  return result;
}

describe('useComparisonStore', () => {
  it('reads back the weights, format and notes saved for this user', async () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(STORED));

    const store = await renderStore();

    expect(store.current.value.weights).toEqual({
      money: 5,
      stack: 1,
      format: 0,
      growth: 2,
      stability: 4,
    });
    expect(store.current.value.preferredMode).toBe('office');
    expect(store.current.notesOf(KEPT).notes).toBe('Сильна команда');
    expect(store.current.notesOf(ADDED)).toEqual({
      notes: '',
      growthNote: '',
      growthRating: null,
      benefits: { equipment: false, education: false, medical: false, vacation: false },
    });
  });

  it('a save keeps only the notes of offers still on the page', async () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(STORED));
    const store = await renderStore();

    act(() => {
      const { value } = store.current;
      store.current.store({ ...value, offers: { ...value.offers, [ADDED]: TICKED_NOTES } });
    });

    const saved = comparisonSchema.parse(JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'));
    expect(Object.keys(saved.offers)).toEqual([KEPT, ADDED]);
    expect(Object.keys(store.current.value.offers)).toEqual([KEPT, ADDED]);
  });

  it('a stored weight out of the 0 to 5 range falls back to every weight at 3 and remote work', async () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ ...STORED, weights: { ...STORED.weights, money: 9 } }),
    );

    const store = await renderStore();

    expect(store.current.value).toEqual({
      weights: { money: 3, stack: 3, format: 3, growth: 3, stability: 3 },
      preferredMode: 'remote',
      offers: {},
    });
  });
});
