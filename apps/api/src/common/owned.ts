import { notFound } from './app-error.js';

export const APPLICATION_NOT_FOUND = 'Application not found';

export function owned<Row>(row: Row | null): Row {
  if (row === null) {
    throw notFound(APPLICATION_NOT_FOUND);
  }
  return row;
}
