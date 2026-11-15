'use client';

import Link from 'next/link';
import { useId, useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { Button } from './button';

export type ChartTableCell = Readonly<{ text: string; href?: string | undefined }>;

export type ChartTableRow = Readonly<{ key: string; cells: readonly ChartTableCell[] }>;

export type ChartTableProps = Readonly<{
  caption: string;
  heads: readonly string[];
  rows: readonly ChartTableRow[];
}>;

const CELL = 'py-1 pr-4 font-normal tabular-nums';

function CellContent({ text, href }: ChartTableCell) {
  if (href === undefined) return text;
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 min-w-11 items-center text-link underline-offset-2 hover:underline active:underline"
    >
      {text}
    </Link>
  );
}

function DataTable({ caption, heads, rows }: ChartTableProps) {
  return (
    <table className="w-full text-left text-[12.5px] text-ink-2">
      <caption className="eyebrow pb-1.5 text-left text-ink-3">{caption}</caption>
      <thead>
        <tr>
          {heads.map((head) => (
            <th key={head} scope="col" className={CELL}>
              {head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, column) => (
              <td key={heads[column] ?? cell.text} className={CELL}>
                <CellContent {...cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartTable(props: ChartTableProps) {
  const tableId = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <Button
        variant="ghost"
        size="xs"
        aria-expanded={shown}
        aria-controls={tableId}
        onClick={() => {
          setShown(!shown);
        }}
      >
        {shown ? uk.ui.hideTable : uk.ui.showTable}
      </Button>
      <div
        id={tableId}
        {...(shown && { role: 'region', 'aria-label': props.caption, tabIndex: 0 })}
        className={cn(
          'self-stretch',
          shown
            ? 'animate-fade-in overflow-x-auto'
            : 'sr-only focus-within:not-sr-only focus-within:overflow-x-auto',
        )}
      >
        <DataTable {...props} />
      </div>
    </div>
  );
}
