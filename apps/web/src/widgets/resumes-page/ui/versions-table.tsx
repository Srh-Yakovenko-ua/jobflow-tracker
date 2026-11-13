'use client';

import type { ResumeVersion } from '@jobflow/shared';
import { useTable } from '@tanstack/react-table';
import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Reveal } from '@/shared/ui/reveal';

import {
  isVersionColumnId,
  VERSION_COLUMNS,
  type VersionColumnId,
  versionTableFeatures,
} from '../model/columns';
import type { ConversionsById, VersionSplit } from '../model/split-versions';
import { END_ALIGNED, VERSION_CELLS } from './version-cells';

const COPY = uk.resumes;

const GRID =
  'grid grid-cols-[minmax(0,2fr)_92px_minmax(120px,1.4fr)_96px_128px] items-center gap-x-4 px-5';

export type VersionsTableView = Readonly<{
  now: Date;
  timeZone: string;
  conversions: ConversionsById;
}>;

export type VersionsTableProps = Readonly<{ split: VersionSplit; view: VersionsTableView }>;

type RowsView = VersionsTableView & Readonly<{ activeId: string | null }>;

type VersionRowsProps = Readonly<{
  versions: ResumeVersion[];
  view: RowsView;
  heading: Readonly<{ label: string; headerClassName?: string }>;
}>;

type HeaderRowProps = Readonly<{
  columns: readonly VersionColumnId[];
  className?: string | undefined;
}>;

function alignOf(id: VersionColumnId) {
  return END_ALIGNED.has(id) && 'text-right';
}

function HeaderRow({ columns, className }: HeaderRowProps) {
  return (
    <div
      role="row"
      className={cn(
        GRID,
        'border-b border-line-soft py-2.75 text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase',
        className,
      )}
    >
      {columns.map((id) => (
        <span
          key={id}
          role="columnheader"
          className={cn(alignOf(id), id === 'actions' && 'sr-only')}
        >
          {COPY.columns[id]}
        </span>
      ))}
    </div>
  );
}

function VersionRows({ versions, view, heading }: VersionRowsProps) {
  const table = useTable({
    features: versionTableFeatures,
    columns: VERSION_COLUMNS,
    data: versions,
    getRowId: (version) => version.id,
  });
  const columns = table
    .getAllLeafColumns()
    .flatMap(({ id }) => (isVersionColumnId(id) ? [id] : []));
  return (
    <div role="table" aria-label={heading.label} className="min-w-160">
      <div role="rowgroup">
        <HeaderRow columns={columns} className={heading.headerClassName} />
      </div>
      <div role="rowgroup">
        {table.getRowModel().rows.map((row) => {
          const active = row.id === view.activeId;
          const conversion = view.conversions.get(row.id) ?? null;
          const rowView = { active, now: view.now, timeZone: view.timeZone, conversion };
          return (
            <motion.div
              key={row.id}
              layout="position"
              role="row"
              className={cn(
                GRID,
                'border-b border-line-soft py-4.5 last:border-b-0',
                active && 'bg-accent-tint',
              )}
            >
              {columns.map((id) => {
                const Cell = VERSION_CELLS[id];
                return (
                  <div key={id} role="cell" className={cn('min-w-0', alignOf(id))}>
                    <Cell version={row.original} view={rowView} />
                  </div>
                );
              })}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ArchiveRows({ split, view }: Readonly<{ split: VersionSplit; view: RowsView }>) {
  const [open, setOpen] = useState(false);
  const label = COPY.archive(split.archive.length);
  return (
    <>
      <div className="sticky left-0 border-t border-line-soft px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          icon={
            <ChevronDown
              aria-hidden
              size={16}
              strokeWidth={1.9}
              className={cn(
                'transition-transform duration-(--duration-base) ease-standard',
                open && 'rotate-180',
              )}
            />
          }
        >
          {label}
        </Button>
      </div>
      <Reveal shown={open}>
        <VersionRows
          versions={split.archive}
          view={view}
          heading={{ label, headerClassName: 'sr-only' }}
        />
      </Reveal>
    </>
  );
}

export function VersionsTable({ split, view }: VersionsTableProps) {
  const rowsView = { ...view, activeId: split.activeId };
  return (
    <div className="min-w-0 overflow-x-auto bg-surface shadow-e1">
      <VersionRows versions={split.visible} view={rowsView} heading={{ label: COPY.title }} />
      {split.archive.length > 0 && <ArchiveRows split={split} view={rowsView} />}
    </div>
  );
}
