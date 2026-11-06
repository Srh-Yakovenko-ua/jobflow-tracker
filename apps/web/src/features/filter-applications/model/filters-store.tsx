'use client';

import type { ApplicationFilters, Source, Stage } from '@jobflow/shared';
import { createStore } from 'zustand/vanilla';

import { createStoreContext } from '@/shared/lib/store-context';

import {
  applicationFiltersOf,
  type FilterChip,
  toggledIn,
  writeFiltersToUrl,
} from './application-filters';

export type ApplicationFiltersActions = Readonly<{
  setQuery: (text: string) => void;
  toggleSource: (source: Source) => void;
  toggleStage: (stage: Stage) => void;
  toggleHasScore: () => void;
  toggleSilentOnly: () => void;
  setSalaryFrom: (text: string) => void;
  remove: (chip: FilterChip) => void;
  reset: () => void;
}>;

export type ApplicationFiltersStore = Readonly<{
  filters: ApplicationFilters;
  actions: ApplicationFiltersActions;
}>;

export function createApplicationFiltersStore(initial: ApplicationFilters) {
  return createStore<ApplicationFiltersStore>()((set, get) => {
    const current = () => get().filters;
    const commit = (filters: ApplicationFilters) => {
      writeFiltersToUrl(filters);
      set({ filters });
    };
    const patch = (change: ApplicationFilters) => {
      commit({ ...current(), ...change });
    };
    return {
      filters: initial,
      actions: {
        setQuery: (text) => {
          patch({ q: text === '' ? undefined : text });
        },
        toggleSource: (source) => {
          patch({ source: toggledIn(current().source, source) });
        },
        toggleStage: (stage) => {
          patch({ stage: toggledIn(current().stage, stage) });
        },
        toggleHasScore: () => {
          patch({ hasScore: current().hasScore === true ? undefined : true });
        },
        toggleSilentOnly: () => {
          patch({ silence: toggledIn(current().silence, 'silent') });
        },
        setSalaryFrom: (text) => {
          patch({ salaryFrom: applicationFiltersOf({ salaryFrom: text }).salaryFrom });
        },
        remove: (chip) => {
          patch(chip.removal);
        },
        reset: () => {
          commit({});
        },
      },
    };
  });
}

const { Provider, useStoreSelector } = createStoreContext({
  name: 'ApplicationFilters',
  create: createApplicationFiltersStore,
});

export { Provider as ApplicationFiltersProvider, useStoreSelector as useApplicationFilters };
