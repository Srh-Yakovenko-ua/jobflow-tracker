'use client';

import { Command } from 'cmdk';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { COMMAND_ITEM, MENU_LABEL } from '@/shared/ui/field-surface';

export type PaletteRowItem = Readonly<{
  value: string;
  label: string;
  keywords?: readonly string[] | undefined;
}> &
  Readonly<{ icon: LucideIcon } | { leading: ReactNode }>;

export type PaletteRowProps = Readonly<{
  item: PaletteRowItem;
  onSelect: () => void;
  children?: ReactNode;
}>;

export type PaletteGroupProps = Readonly<{
  label: string;
  forceMount?: boolean;
  children: ReactNode;
}>;

const PALETTE_ROW = cn(COMMAND_ITEM, 'max-sm:min-h-11');

function RowLeading({ item }: Readonly<{ item: PaletteRowItem }>) {
  if ('leading' in item) {
    return <span className="flex w-4 flex-none justify-center">{item.leading}</span>;
  }
  const Icon = item.icon;
  return <Icon aria-hidden size={16} className="flex-none text-ink-3" />;
}

export function PaletteRow({ item, onSelect, children }: PaletteRowProps) {
  return (
    <Command.Item
      value={item.value}
      keywords={[item.label, ...(item.keywords ?? [])]}
      onSelect={onSelect}
      className={PALETTE_ROW}
    >
      <RowLeading item={item} />
      {children ?? <span className="min-w-0 flex-1 truncate">{item.label}</span>}
    </Command.Item>
  );
}

export function PaletteGroup({ label, forceMount = false, children }: PaletteGroupProps) {
  return (
    <Command.Group
      forceMount={forceMount}
      heading={<span className={cn(MENU_LABEL, 'block')}>{label}</span>}
    >
      {children}
    </Command.Group>
  );
}
