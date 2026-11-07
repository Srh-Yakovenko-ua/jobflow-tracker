import { AI_KINDS, AI_PAYLOAD_FIELDS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type ModelDataItem = Readonly<{ id: string; text: string }>;

const COPY = uk.settings.aiPrivacy.modelData.fields;

export function modelDataItems(): readonly ModelDataItem[] {
  return AI_KINDS.flatMap((kind) =>
    AI_PAYLOAD_FIELDS[kind].map((field) => ({ id: `${kind}.${field}`, text: COPY[kind][field] })),
  );
}
