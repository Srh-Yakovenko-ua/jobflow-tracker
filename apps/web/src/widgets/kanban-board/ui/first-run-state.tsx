import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { DashedBars, EmptyState } from '@/shared/ui/empty-state';

export type FirstRunStateProps = Readonly<{ action?: ReactNode }>;

export function FirstRunState({ action }: FirstRunStateProps) {
  return (
    <EmptyState
      content={uk.board.firstRun}
      view={{ size: 'page' }}
      slots={{ figure: <DashedBars />, action }}
    />
  );
}
