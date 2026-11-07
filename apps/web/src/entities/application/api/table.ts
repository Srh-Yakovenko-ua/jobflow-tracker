import {
  type ApplicationFilters,
  type ApplicationListItem,
  PAGINATION_LIMITS,
} from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { applicationKeys } from '../model/keys';
import { type ApplicationPageRequest, fetchApplicationPage } from './list';

const TABLE_PAGE = { limit: PAGINATION_LIMITS.maxLimit, sort: '-lastEventAt' } as const;

async function rowsFrom(
  request: ApplicationPageRequest,
  loaded: readonly ApplicationListItem[],
): Promise<ApplicationListItem[]> {
  const page = await fetchApplicationPage(request);
  const rows = [...loaded, ...page.items];
  if (page.nextCursor === null) {
    return rows;
  }
  return rowsFrom({ ...request, query: { ...request.query, cursor: page.nextCursor } }, rows);
}

export function applicationTableQueryOptions(filters: ApplicationFilters) {
  return queryOptions({
    queryKey: applicationKeys.table(filters),
    queryFn: ({ signal }) => rowsFrom({ query: { ...filters, ...TABLE_PAGE }, signal }, []),
  });
}
