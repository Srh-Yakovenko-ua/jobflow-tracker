'use client';

import { Command } from 'cmdk';
import { Check, Search, SearchX } from 'lucide-react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import {
  CHECK_BOX,
  MENU_LABEL,
  OPTION_ROW,
  type SelectOption,
  type SelectOptionGroup,
} from './field-surface';
import { Kbd } from './kbd';
import { OptionContent } from './option-content';

export type ComboboxMode = 'single' | 'multi';

export type ComboboxView = { label: string; search: string; placeholder?: string };

export type ComboboxMenuProps = Readonly<{
  groups: readonly SelectOptionGroup[];
  selection: { mode: ComboboxMode; picked: readonly string[] };
  actions: { onPick: (value: string) => void; onCreate?: ((query: string) => void) | undefined };
  view: ComboboxView;
}>;

const ITEM = cn(
  OPTION_ROW,
  'data-[selected=true]:bg-accent-tint data-[selected=true]:shadow-[inset_2px_0_0_var(--accent)]',
);

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

type ItemMarkProps = Readonly<{ mode: ComboboxMode; checked: boolean }>;

function ItemMark({ mode, checked }: ItemMarkProps) {
  if (mode === 'multi') {
    return (
      <span aria-hidden className={cn(CHECK_BOX.base, checked ? CHECK_BOX.on : CHECK_BOX.off)}>
        {checked && <Check size={12} strokeWidth={2.4} />}
      </span>
    );
  }
  return (
    <span aria-hidden className="flex w-3.75 flex-none justify-center text-accent-press">
      {checked && <Check size={14} />}
    </span>
  );
}

function NoMatches() {
  return (
    <div role="status" className="flex flex-col items-center gap-2 px-2.5 pt-4 pb-3 text-center">
      <span
        aria-hidden
        className="flex size-6.5 items-center justify-center rounded-md bg-surface-2 text-ink-3"
      >
        <SearchX size={15} />
      </span>
      <span className="text-[12.5px] text-ink-3">{uk.ui.noMatches}</span>
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
        className={cn(ITEM, checked && 'font-semibold')}
      >
        <ItemMark mode={selection.mode} checked={checked} />
        <OptionContent option={option} label={option.label} />
      </Command.Item>
    );
  };
  return (
    <Command label={view.label} shouldFilter={false} className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line-soft px-2.5 pb-1.5 transition-colors duration-(--duration-instant) has-[input:focus-visible]:border-accent">
        <Search aria-hidden size={15} className="flex-none text-ink-3" />
        <Command.Input
          data-focus="halo"
          value={query}
          onValueChange={setQuery}
          placeholder={view.search}
          className="h-9 min-w-0 flex-1 bg-transparent text-body outline-hidden placeholder:text-ink-3"
        />
      </div>
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
            className={cn(ITEM, 'font-semibold text-accent-press')}
          >
            {uk.ui.addOption(needle)}
          </Command.Item>
        )}
      </Command.List>
      <MenuFooter count={{ shown, total: countOptions(groups) }} />
    </Command>
  );
}
