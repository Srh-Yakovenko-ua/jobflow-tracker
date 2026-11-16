'use client';

import {
  type ApplicationCard,
  type ApplicationListItem,
  isActiveStage,
  type Stage,
} from '@jobflow/shared';
import { Command } from 'cmdk';

import { OutcomeBadge, SearchSnippet, StageChip } from '@/entities/application';
import { COMMAND_ITEM } from '@/shared/ui/field-surface';

import { ApplicationOptionContent } from './application-option-content';

export const FOUND_RESULT_PREFIX = 'found:';

export type ApplicationResultItemProps = Readonly<{
  application: ApplicationListItem;
  onPick: (application: ApplicationCard) => void;
  disabled?: boolean;
}>;

function StageMark({ stage }: Readonly<{ stage: Stage }>) {
  return isActiveStage(stage) ? <StageChip stage={stage} /> : <OutcomeBadge outcome={stage} />;
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
