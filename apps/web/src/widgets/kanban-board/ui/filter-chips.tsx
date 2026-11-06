'use client';

import { uk } from '@/shared/i18n';
import { Button, type ButtonLinkLook } from '@/shared/ui/button';
import { ChipList } from '@/shared/ui/chip-list';

import { chipsOf } from '../model/board-filters';
import { useBoardFilters } from '../model/board-filters-store';
import { BOARD_SEARCH_ID } from './board-search';

const COPY = uk.board.filters;

export function FilterChips() {
  const filters = useBoardFilters((store) => store.filters);
  const { remove } = useBoardFilters((store) => store.actions);
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
  const { reset } = useBoardFilters((store) => store.actions);
  return (
    <Button
      variant={look.variant}
      size={look.size}
      onClick={() => {
        reset();
        document.getElementById(BOARD_SEARCH_ID)?.focus();
      }}
    >
      {COPY.reset}
    </Button>
  );
}

export function FilterChipsRow() {
  const active = useBoardFilters((store) => chipsOf(store.filters).length > 0);
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
