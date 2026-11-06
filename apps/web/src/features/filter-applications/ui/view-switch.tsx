'use client';

import { useRouter } from 'next/navigation';

import { withSearchParams } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { useApplicationFilters } from '../model/filters-store';

const COPY = uk.board.views;

const VIEW_PATHS = { board: '/board', table: '/applications' } as const;

export type ApplicationsView = keyof typeof VIEW_PATHS;

const VIEW_OPTIONS = (['board', 'table'] as const).map((view) => ({
  value: view,
  label: COPY[view],
}));

export type ViewSwitchProps = Readonly<{ current: ApplicationsView }>;

export function ViewSwitch({ current }: ViewSwitchProps) {
  const router = useRouter();
  const filters = useApplicationFilters((store) => store.filters);
  return (
    <SegmentedControl
      aria-label={COPY.label}
      options={VIEW_OPTIONS}
      value={current}
      onValueChange={(view) => {
        router.push(withSearchParams(VIEW_PATHS[view], filters));
      }}
    />
  );
}
