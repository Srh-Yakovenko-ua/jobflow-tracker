import { notFound } from './app-error.js';

export const APPLICATION_NOT_FOUND = 'Application not found';

export function owned<Row>(row: Row | null, missing = APPLICATION_NOT_FOUND): Row {
  if (row === null) {
    throw notFound(missing);
  }
  return row;
}

export function changedOrNotFound(count: number, missing: string): void {
  if (count === 0) {
    throw notFound(missing);
  }
}
