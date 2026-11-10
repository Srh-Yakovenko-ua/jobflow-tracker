import { SOURCE_LABELS, SOURCES } from '@jobflow/shared';

import type { SelectOption } from './field-surface';

export const SOURCE_OPTIONS: readonly SelectOption[] = SOURCES.map((source) => ({
  value: source,
  label: SOURCE_LABELS[source].labelUk,
}));
