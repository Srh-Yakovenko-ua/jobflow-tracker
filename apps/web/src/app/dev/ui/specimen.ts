import { ACTIVE_STAGES, STAGE_LABELS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import type { SelectOptionGroup } from '@/shared/ui/field-surface';

const CV = uk.devUi.selects.cv;

export const CV_GROUPS: readonly SelectOptionGroup[] = [
  {
    label: CV.active,
    options: [
      { value: 'cv-v2', ...CV.options.product },
      { value: 'cv-v3', ...CV.options.design },
    ],
  },
  { label: CV.archive, options: [{ value: 'cv-v1', ...CV.options.chronological }] },
];

export const STAGE_GROUPS: readonly SelectOptionGroup[] = [
  { options: ACTIVE_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage].labelUk })) },
];

export const THRESHOLD_DAYS = ['3', '7', '14', '21'] as const;

export type ThresholdDays = (typeof THRESHOLD_DAYS)[number];
