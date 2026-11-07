'use client';

import { uk } from '@/shared/i18n';
import { ChipList } from '@/shared/ui/chip-list';

import { chipsOf } from '../model/application-filters';
import { useApplicationFilters } from '../model/filters-store';
import { focusFilterSearch } from './filter-search';
import { ResetFiltersButton } from './reset-filters-button';

const COPY = uk.board.filters;

export function FilterChips() {
  const filters = useApplicationFilters((store) => store.filters);
  const { remove } = useApplicationFilters((store) => store.actions);
  const chips = chipsOf(filters);
  if (chips.length === 0) {
    return null;
  }
  const items = chips.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => {
      remove(chip);
      if (chips.length === 1) {
        focusFilterSearch();
      }
    },
  }));
  return <ChipList label={COPY.chips.label} items={items} />;
}

export function FilterChipsRow() {
  const active = useApplicationFilters((store) => chipsOf(store.filters).length > 0);
  if (!active) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
      <FilterChips />
      <ResetFiltersButton look={{ variant: 'ghost', size: 'sm' }} />
    </div>
  );
}
