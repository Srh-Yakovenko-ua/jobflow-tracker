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
import { COMMAND_ITEM } from '@/shared/ui/field-surface';
import { OptionContent } from '@/shared/ui/option-content';

export const FOUND_RESULT_PREFIX = 'found:';

export type ApplicationResultItemProps = Readonly<{
  application: ApplicationListItem;
  onPick: (application: ApplicationCard) => void;
  disabled?: boolean;
}>;

export type ApplicationOptionContentProps = Readonly<{
  application: Pick<ApplicationCard, 'id' | 'company' | 'position'>;
  footnote?: ReactNode;
}>;

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

export function ApplicationResultItem({
  application,
  onPick,
  disabled = false,
}: ApplicationResultItemProps) {
  return (
    <Command.Item
      value={`${FOUND_RESULT_PREFIX}${application.id}`}
      disabled={disabled}
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
