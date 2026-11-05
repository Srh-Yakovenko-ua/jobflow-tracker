'use client';

import { createStore } from 'zustand/vanilla';

import type { CardDensity } from '@/entities/application';
import { writeCookie } from '@/shared/lib/cookie';
import { createStoreContext } from '@/shared/lib/store-context';

import { BOARD_DENSITY_COOKIE, type BoardDensityState } from './board-density-cookie';

export type BoardDensityStore = BoardDensityState & { setDensity: (density: CardDensity) => void };

export function createBoardDensityStore(initial: BoardDensityState) {
  return createStore<BoardDensityStore>()((set) => ({
    ...initial,
    setDensity: (density) => {
      writeCookie({ name: BOARD_DENSITY_COOKIE, value: density });
      set({ density });
    },
  }));
}

const { Provider, useStoreSelector } = createStoreContext({
  name: 'BoardDensity',
  create: createBoardDensityStore,
});

export { Provider as BoardDensityProvider, useStoreSelector as useBoardDensity };
