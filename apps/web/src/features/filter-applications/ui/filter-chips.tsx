'use client';

import { uk } from '@/shared/i18n';
import { Button, type ButtonLinkLook } from '@/shared/ui/button';
import { ChipList } from '@/shared/ui/chip-list';

import { chipsOf } from '../model/application-filters';
import { useApplicationFilters } from '../model/filters-store';
import { FILTER_SEARCH_ID } from './filter-search';

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
    },
  }));
  return <ChipList label={COPY.chips.label} items={items} />;
}

export type ResetFiltersButtonProps = Readonly<{ look: ButtonLinkLook }>;

export function ResetFiltersButton({ look }: ResetFiltersButtonProps) {
  const { reset } = useApplicationFilters((store) => store.actions);
  return (
    <Button
      variant={look.variant}
      size={look.size}
      onClick={() => {
        reset();
        document.getElementById(FILTER_SEARCH_ID)?.focus();
      }}
    >
      {COPY.reset}
    </Button>
  );
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
