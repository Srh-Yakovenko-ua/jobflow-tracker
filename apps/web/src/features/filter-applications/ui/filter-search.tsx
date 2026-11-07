'use client';

import { Search } from 'lucide-react';
import { useRef } from 'react';

import { SEARCH_LIMITS } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { ClearButton } from '@/shared/ui/clear-button';
import { Input } from '@/shared/ui/input';

import { useApplicationFilters } from '../model/filters-store';

export type FilterSearchCopy = Readonly<{ label: string; placeholder: string }>;

export type FilterSearchProps = Readonly<{ copy: FilterSearchCopy }>;

export const FILTER_SEARCH_ID = 'filter-search';

export function focusFilterSearch(): void {
  document.getElementById(FILTER_SEARCH_ID)?.focus();
}

export function FilterSearch({ copy }: FilterSearchProps) {
  const text = useApplicationFilters((store) => store.filters.q ?? '');
  const { setQuery } = useApplicationFilters((store) => store.actions);
  const inputRef = useRef<HTMLInputElement>(null);
  const clear = () => {
    setQuery('');
    inputRef.current?.focus();
  };
  return (
    <Input
      ref={inputRef}
      id={FILTER_SEARCH_ID}
      value={text}
      onChange={(event) => {
        setQuery(event.target.value);
      }}
      maxLength={SEARCH_LIMITS.maxLength}
      enterKeyHint="search"
      autoComplete="off"
      aria-label={copy.label}
      placeholder={copy.placeholder}
      className="w-full sm:w-60"
      adornments={{
        start: <Search aria-hidden size={15} className="flex-none text-ink-3" />,
        end: text !== '' && <ClearButton label={uk.ui.clear} onClear={clear} />,
      }}
    />
  );
}
