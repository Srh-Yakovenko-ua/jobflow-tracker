'use client';

import {
  type ApplicationCard,
  type ApplicationListItem,
  isActiveStage,
  type Stage,
} from '@jobflow/shared';
import { Command } from 'cmdk';
import type { ReactNode } from 'react';

import { OutcomeBadge, SearchSnippet, StageChip } from '@/entities/application';
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

export type ApplicationResultItemProps = Readonly<{
  application: ApplicationListItem;
  onPick: (application: ApplicationCard) => void;
}>;

export type ApplicationOptionContentProps = Readonly<{
  application: Pick<ApplicationCard, 'id' | 'company' | 'position'>;
  footnote?: ReactNode;
}>;

export type SearchStatusProps = Readonly<{ search: ApplicationSearch }>;

export type SearchRetryItemProps = SearchStatusProps & Readonly<{ forceMount?: boolean }>;

const STATUS_ROW = 'caption flex items-center gap-2 px-2.5 py-3';

export function SearchStatus({ search }: SearchStatusProps) {
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

export function ApplicationOptionContent({ application, footnote }: ApplicationOptionContentProps) {
  return (
    <OptionContent
      option={{ value: application.id, label: application.position, detail: application.company }}
      label={application.position}
      footnote={footnote}
    />
  );
}

export function ApplicationResultItem({ application, onPick }: ApplicationResultItemProps) {
  return (
    <Command.Item
      value={application.id}
      onSelect={() => {
        onPick(application);
      }}
      className={COMMAND_ITEM}
    >
      <ApplicationOptionContent
        application={application}
        footnote={application.snippet && <SearchSnippet snippet={application.snippet} />}
      />
      <StageMark stage={application.currentStage} />
    </Command.Item>
  );
}

export function SearchRetryItem({ search, forceMount = false }: SearchRetryItemProps) {
  if (!search.isError) return null;
  return (
    <Command.Item
      value="retry"
      forceMount={forceMount}
      onSelect={() => {
        void search.refetch();
      }}
      className={cn(COMMAND_ITEM, 'font-semibold text-link')}
    >
      {SEARCH.retry}
    </Command.Item>
  );
}

export function SearchResults({ search, onPick }: SearchResultsProps) {
  return (
    <>
      <SearchStatus search={search} />
      <Command.List label={SEARCH.results} className="max-h-80 overflow-y-auto">
        {search.data?.items.map((application) => (
          <ApplicationResultItem key={application.id} application={application} onPick={onPick} />
        ))}
        <SearchRetryItem search={search} />
      </Command.List>
    </>
  );
}
