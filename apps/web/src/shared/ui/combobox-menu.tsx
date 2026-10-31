'use client';

import { Command } from 'cmdk';
import { Check, Search } from 'lucide-react';
import { useRef, useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { ClearButton } from './clear-button';
import {
  CHECK_BOX,
  COMMAND_ITEM,
  FIELD_SURFACE,
  MENU_LABEL,
  type SelectOption,
  type SelectOptionGroup,
} from './field-surface';
import { Kbd } from './kbd';
import { NoMatches } from './no-matches';
import { CheckSlot, OptionContent } from './option-content';

export type ComboboxMode = 'single' | 'multi';

export type ComboboxView = {
  label: string;
  search: string;
  placeholder?: string;
  footer?: boolean;
  clearable?: boolean;
};

export type ComboboxMenuProps = Readonly<{
  groups: readonly SelectOptionGroup[];
  selection: { mode: ComboboxMode; picked: readonly string[] };
  actions: { onPick: (value: string) => void; onCreate?: ((query: string) => void) | undefined };
  view: ComboboxView;
}>;

const CREATE_PREFIX = 'create:';

function filterGroups(groups: readonly SelectOptionGroup[], needle: string) {
  const query = needle.toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.label.toLowerCase().includes(query)),
    }))
    .filter((group) => group.options.length > 0);
}

function countOptions(groups: readonly SelectOptionGroup[]): number {
  return groups.reduce((sum, group) => sum + group.options.length, 0);
}

function BoxMark({ checked }: Readonly<{ checked: boolean }>) {
  return (
    <span aria-hidden className={cn(CHECK_BOX.base, checked ? CHECK_BOX.on : CHECK_BOX.off)}>
      {checked && <Check size={12} strokeWidth={2.4} />}
    </span>
  );
}

type SearchRowProps = Readonly<{
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
}>;

function SearchRow({ query, onQueryChange, placeholder }: SearchRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        FIELD_SURFACE.shell,
        'h-8.5 flex-none gap-2 px-2.5 shadow-none inset-ring inset-ring-line-soft',
      )}
    >
      <Search aria-hidden size={15} className="flex-none text-ink-3" />
      <Command.Input
        ref={inputRef}
        data-focus="halo"
        value={query}
        onValueChange={onQueryChange}
        placeholder={placeholder}
        className={cn(FIELD_SURFACE.control, 'text-[13px]')}
      />
      {query !== '' && (
        <ClearButton
          label={uk.ui.clear}
          onClear={() => {
            onQueryChange('');
            inputRef.current?.focus();
          }}
          className="size-5"
        />
      )}
    </div>
  );
}

function MenuFooter({ count }: Readonly<{ count: { shown: number; total: number } }>) {
  return (
    <div className="caption mt-1 flex items-center justify-between gap-3 border-t border-line-soft px-2.5 pt-2 pb-1 text-ink-3">
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <Kbd>{uk.ui.keys.navigate}</Kbd>
          {uk.ui.navigate}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>{uk.ui.keys.select}</Kbd>
          {uk.ui.select}
        </span>
      </span>
      <span className="tabular-nums">{`${String(count.shown)} ${uk.ui.ofTotal} ${String(count.total)}`}</span>
    </div>
  );
}

export function ComboboxMenu({ groups, selection, actions, view }: ComboboxMenuProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim();
  const visible = filterGroups(groups, needle);
  const shown = countOptions(visible);
  const exists = groups.some((group) =>
    group.options.some((option) => option.label.toLowerCase() === needle.toLowerCase()),
  );
  const create = needle !== '' && !exists ? actions.onCreate : undefined;
  const renderItem = (option: SelectOption) => {
    const checked = selection.picked.includes(option.value);
    return (
      <Command.Item
        key={option.value}
        value={option.value}
        onSelect={() => {
          actions.onPick(option.value);
        }}
        aria-checked={selection.mode === 'multi' ? checked : undefined}
        className={cn(COMMAND_ITEM, checked && 'font-semibold')}
      >
        {selection.mode === 'multi' && <BoxMark checked={checked} />}
        <OptionContent option={option} label={option.label} />
        {selection.mode === 'single' && <CheckSlot checked={checked} />}
      </Command.Item>
    );
  };
  return (
    <Command label={view.label} shouldFilter={false} className="flex flex-col">
      <SearchRow query={query} onQueryChange={setQuery} placeholder={view.search} />
      {shown === 0 && <NoMatches />}
      <Command.List label={view.label} className="mt-1 max-h-64 overflow-y-auto">
        {visible.map((group) => (
          <Command.Group
            key={group.label ?? group.options[0]?.value}
            heading={group.label && <span className={cn(MENU_LABEL, 'block')}>{group.label}</span>}
          >
            {group.options.map(renderItem)}
          </Command.Group>
        ))}
        {create && (
          <Command.Item
            value={`${CREATE_PREFIX}${needle}`}
            onSelect={() => {
              create(needle);
              setQuery('');
            }}
            className={cn(COMMAND_ITEM, 'font-semibold text-link')}
          >
            {uk.ui.addOption(needle)}
          </Command.Item>
        )}
      </Command.List>
      {view.footer !== false && <MenuFooter count={{ shown, total: countOptions(groups) }} />}
    </Command>
  );
}
