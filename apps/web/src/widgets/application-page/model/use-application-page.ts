import {
  type Application,
  applicationIdSchema,
  type ScheduledEvent,
  type Stage,
} from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { applicationQueryOptions } from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';
import type { EditField } from '@/features/edit-application';
import type { SchedulePlan } from '@/features/schedule-event';
import { ApiError } from '@/shared/api';

export type ApplicationPanel =
  { kind: 'edit'; field: EditField } | { kind: 'delete' } | SchedulePlan;

export type ApplicationPageActions = Readonly<{
  onEdit: (field: EditField) => void;
  onDelete: () => void;
  onSchedule: () => void;
  onReschedule: (event: ScheduledEvent) => void;
  onSuggest: (stage: Stage | null) => void;
  onClose: () => void;
}>;

const MISSING_STATUSES: ReadonlySet<number> = new Set([404, 422]);

function isMissing(error: Error | null): boolean {
  return error instanceof ApiError && MISSING_STATUSES.has(error.status);
}

export function useApplicationPage(id: Application['id']) {
  const valid = applicationIdSchema.safeParse(id).success;
  const query = useQuery({ ...applicationQueryOptions(id), enabled: valid });
  const timeZone = useUserTimeZone();
  const [panel, setPanel] = useState<ApplicationPanel | null>(null);
  const [suggested, setSuggested] = useState<Stage | null>(null);
  const actions: ApplicationPageActions = {
    onEdit: (field) => {
      setPanel({ kind: 'edit', field });
    },
    onDelete: () => {
      setPanel({ kind: 'delete' });
    },
    onSchedule: () => {
      setPanel({ kind: 'schedule' });
    },
    onReschedule: (event) => {
      setPanel({ kind: 'reschedule', event });
    },
    onSuggest: setSuggested,
    onClose: () => {
      setPanel(null);
    },
  };
  return {
    application: query.data,
    timeZone,
    missing: !valid || isMissing(query.error),
    load: {
      failed: query.isError && !query.isFetching,
      onRetry: () => {
        void query.refetch();
      },
    },
    panel,
    suggestion: suggested === query.data?.currentStage ? null : suggested,
    actions,
  };
}
