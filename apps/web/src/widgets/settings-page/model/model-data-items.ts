import { AI_KINDS, AI_PAYLOAD_FIELDS, type AiKind, type AiPayloadField } from '@jobflow/shared';

import { type ModelDataCopy, uk } from '@/shared/i18n';

export type ModelDataItem = Readonly<{ id: string; text: string }>;

type PayloadFields = { [Kind in AiKind]: readonly AiPayloadField<Kind>[] };

const FIELDS: PayloadFields = AI_PAYLOAD_FIELDS;

const COPY: ModelDataCopy = uk.settings.aiPrivacy.modelData.fields;

function kindItems<Kind extends AiKind>(kind: Kind, copy: ModelDataCopy[Kind]): ModelDataItem[] {
  return FIELDS[kind].map((field) => ({ id: `${kind}.${field}`, text: copy[field] }));
}

export function modelDataItems(): readonly ModelDataItem[] {
  return AI_KINDS.flatMap((kind) => kindItems(kind, COPY[kind]));
}
