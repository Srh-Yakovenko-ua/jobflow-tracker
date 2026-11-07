'use client';

import { uk } from '@/shared/i18n';
import { Button, type ButtonLinkLook } from '@/shared/ui/button';

import { useApplicationFilters } from '../model/filters-store';
import { focusFilterSearch } from './filter-search';

const COPY = uk.board.filters;

export type ResetFiltersButtonProps = Readonly<{ look: ButtonLinkLook }>;

export function ResetFiltersButton({ look }: ResetFiltersButtonProps) {
  const { reset } = useApplicationFilters((store) => store.actions);
  return (
    <Button
      variant={look.variant}
      size={look.size}
      onClick={() => {
        reset();
        focusFilterSearch();
      }}
    >
      {COPY.reset}
    </Button>
  );
}
