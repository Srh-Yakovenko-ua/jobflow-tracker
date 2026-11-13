import { within } from '@testing-library/react';

import type { ChartTableRow } from '@/shared/ui/chart-table';

export function rowTexts(rows: readonly ChartTableRow[]): string[][] {
  return rows.map(({ cells }) => cells.map(({ text }) => text));
}

export function tableCells(table: HTMLElement): (string | null)[][] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );
}
