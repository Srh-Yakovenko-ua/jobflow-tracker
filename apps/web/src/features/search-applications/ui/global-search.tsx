'use client';

import type { ApplicationCard } from '@jobflow/shared';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { ClearButton } from '@/shared/ui/clear-button';
import { FIELD_SURFACE } from '@/shared/ui/field-surface';
import { Kbd } from '@/shared/ui/kbd';
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/ui/popover';

import { isSearchable, SEARCH_LIMITS, useApplicationSearch } from '../model/use-application-search';
import { SEARCH_SHORTCUT, useSlashShortcut } from '../model/use-slash-shortcut';
import { SearchResults } from './search-results';

const SEARCH = uk.shell.search;

export function GlobalSearch() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const search = useApplicationSearch(text);
  const shown = open && isSearchable(text.trim());
  useSlashShortcut(inputRef);
  useEffect(() => {
    inputRef.current?.setAttribute('aria-expanded', String(shown));
  }, [shown]);

  const edit = (next: string) => {
    setText(next);
    setOpen(true);
  };
  const pick = (application: ApplicationCard) => {
    router.push(`/applications/${application.id}`);
    setText('');
    setOpen(false);
  };
  const keepOpenInsideField = (event: Event) => {
    if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
      event.preventDefault();
    }
  };

  return (
    <Command label={SEARCH.label} shouldFilter={false} vimBindings={false}>
      <Popover open={shown} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            className={cn(FIELD_SURFACE.shell, FIELD_SURFACE.height.field, 'gap-2 px-3')}
          >
            <Search aria-hidden size={15} className="flex-none text-ink-3" />
            <Command.Input
              ref={inputRef}
              data-focus="halo"
              value={text}
              onValueChange={edit}
              onFocus={() => {
                setOpen(true);
              }}
              maxLength={SEARCH_LIMITS.maxLength}
              aria-keyshortcuts={SEARCH_SHORTCUT}
              placeholder={SEARCH.placeholder}
              className={FIELD_SURFACE.control}
            />
            {text === '' ? (
              <span aria-hidden className="hidden md:inline-flex">
                <Kbd>{SEARCH_SHORTCUT}</Kbd>
              </span>
            ) : (
              <ClearButton
                label={uk.ui.clear}
                onClear={() => {
                  setText('');
                  inputRef.current?.focus();
                }}
              />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          aria-label={SEARCH.results}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onInteractOutside={keepOpenInsideField}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          className="w-(--radix-popover-trigger-width) p-1.5"
        >
          <SearchResults search={search} onPick={pick} />
        </PopoverContent>
      </Popover>
    </Command>
  );
}
