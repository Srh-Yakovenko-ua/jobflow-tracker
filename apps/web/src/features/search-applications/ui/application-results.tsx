'use client';

import type { ApplicationCard } from '@jobflow/shared';

import type { ApplicationSearch } from '../model/use-application-search';
import { ApplicationResultItem } from './application-result-item';

export type ApplicationResultsProps = Readonly<{
  search: ApplicationSearch;
  onPick: (application: ApplicationCard) => void;
}>;

export function ApplicationResults({ search, onPick }: ApplicationResultsProps) {
  const stale = search.isPlaceholderData;
  return search.data?.items.map((application) => (
    <ApplicationResultItem
      key={`${application.id}:${stale ? 'stale' : 'fresh'}`}
      application={application}
      onPick={onPick}
      disabled={stale}
    />
  ));
}
