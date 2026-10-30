'use client';

import { type ApplicationCard, isActiveStage, type Stage } from '@jobflow/shared';
import { Command } from 'cmdk';

import { OutcomeBadge, StageChip } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { COMMAND_ITEM } from '@/shared/ui/field-surface';
import { NoMatches } from '@/shared/ui/no-matches';
import { OptionContent } from '@/shared/ui/option-content';
import { Spinner } from '@/shared/ui/spinner';

import type { ApplicationSearch } from '../model/use-application-search';

const SEARCH = uk.shell.search;

export type SearchResultsProps = Readonly<{
  search: ApplicationSearch;
  onPick: (application: ApplicationCard) => void;
}>;

const STATUS_ROW = 'caption flex items-center gap-2 px-2.5 py-3';

function SearchStatus({ search }: Readonly<{ search: ApplicationSearch }>) {
  if (search.isPending) {
    return (
      <div role="status" className={cn(STATUS_ROW, 'text-ink-3')}>
        <Spinner />
        {SEARCH.loading}
      </div>
    );
  }
  if (search.isError) {
    return (
      <p role="alert" className={cn(STATUS_ROW, 'text-danger')}>
        {SEARCH.error}
      </p>
    );
  }
  return search.data.items.length === 0 ? <NoMatches /> : null;
}

function StageMark({ stage }: Readonly<{ stage: Stage }>) {
  return isActiveStage(stage) ? <StageChip stage={stage} /> : <OutcomeBadge outcome={stage} />;
}

function optionOf(application: ApplicationCard) {
  return { value: application.id, label: application.position, detail: application.company };
}

export function SearchResults({ search, onPick }: SearchResultsProps) {
  return (
    <>
      <SearchStatus search={search} />
      <Command.List label={SEARCH.results} className="max-h-80 overflow-y-auto">
        {search.data?.items.map((application) => (
          <Command.Item
            key={application.id}
            value={application.id}
            onSelect={() => {
              onPick(application);
            }}
            className={COMMAND_ITEM}
          >
            <OptionContent option={optionOf(application)} label={application.position} />
            <StageMark stage={application.currentStage} />
          </Command.Item>
        ))}
        {search.isError && (
          <Command.Item
            value="retry"
            onSelect={() => {
              void search.refetch();
            }}
            className={cn(COMMAND_ITEM, 'font-semibold text-link')}
          >
            {SEARCH.retry}
          </Command.Item>
        )}
      </Command.List>
    </>
  );
}
