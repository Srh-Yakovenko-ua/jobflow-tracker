'use client';

import { Search } from 'lucide-react';
import { useRef } from 'react';

import { SEARCH_LIMITS } from '@/features/search-applications';
import { uk } from '@/shared/i18n';
import { ClearButton } from '@/shared/ui/clear-button';
import { Input } from '@/shared/ui/input';

import { useBoardFilters } from '../model/board-filters-store';

const COPY = uk.board.filters.search;

export const BOARD_SEARCH_ID = 'board-search';

export function BoardSearch() {
  const text = useBoardFilters((store) => store.filters.q ?? '');
  const { setQuery } = useBoardFilters((store) => store.actions);
  const inputRef = useRef<HTMLInputElement>(null);
  const clear = () => {
    setQuery('');
    inputRef.current?.focus();
  };
  return (
    <Input
      ref={inputRef}
      id={BOARD_SEARCH_ID}
      value={text}
      onChange={(event) => {
        setQuery(event.target.value);
      }}
      maxLength={SEARCH_LIMITS.maxLength}
      enterKeyHint="search"
      autoComplete="off"
      aria-label={COPY.label}
      placeholder={COPY.placeholder}
      className="w-full sm:w-60"
      adornments={{
        start: <Search aria-hidden size={15} className="flex-none text-ink-3" />,
        end: text !== '' && <ClearButton label={uk.ui.clear} onClear={clear} />,
      }}
    />
  );
}
