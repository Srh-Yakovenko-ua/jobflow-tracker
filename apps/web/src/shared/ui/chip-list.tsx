'use client';

import { useRef } from 'react';

import { Chip } from './chip';

export type ChipListItem = Readonly<{ id: string; label: string; onRemove: () => void }>;

export type ChipListProps = Readonly<{ label: string; items: readonly ChipListItem[] }>;

function focusNeighbour(list: HTMLUListElement | null, index: number) {
  const removeButtons = list?.querySelectorAll('button') ?? [];
  (removeButtons[index + 1] ?? removeButtons[index - 1])?.focus();
}

export function ChipList({ label, items }: ChipListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  return (
    <ul ref={listRef} aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <li key={item.id} className="flex">
          <Chip
            tone="neutral"
            label={item.label}
            onRemove={() => {
              focusNeighbour(listRef.current, index);
              item.onRemove();
            }}
          />
        </li>
      ))}
    </ul>
  );
}
