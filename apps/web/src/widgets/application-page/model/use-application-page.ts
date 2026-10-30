import { type Application, applicationIdSchema } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { applicationQueryOptions } from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';
import type { EditField } from '@/features/edit-application';
import { ApiError } from '@/shared/api';

export type ApplicationPanel = { kind: 'edit'; field: EditField } | { kind: 'delete' };

export type ApplicationPageActions = Readonly<{
  onEdit: (field: EditField) => void;
  onDelete: () => void;
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
  const actions: ApplicationPageActions = {
    onEdit: (field) => {
      setPanel({ kind: 'edit', field });
    },
    onDelete: () => {
      setPanel({ kind: 'delete' });
    },
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
    actions,
  };
}
