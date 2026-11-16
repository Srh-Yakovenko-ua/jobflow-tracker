import { AI_KINDS, AI_PAYLOAD_FIELDS, type AiKind, type AiPayloadField } from '@jobflow/shared';

import { type ModelDataCopy, uk } from '@/shared/i18n';

export type ModelDataItem = Readonly<{ id: string; text: string }>;

type PayloadFields = { [Kind in AiKind]: readonly AiPayloadField<Kind>[] };

const FIELDS: PayloadFields = AI_PAYLOAD_FIELDS;

const MODEL_DATA = uk.settings.aiPrivacy.modelData;

const COPY: ModelDataCopy = MODEL_DATA.fields;

function kindLabels<Kind extends AiKind>(kind: Kind, copy: ModelDataCopy[Kind]): string[] {
  return [...new Set(FIELDS[kind].map((field) => copy[field]))];
}

export function modelDataItems(): readonly ModelDataItem[] {
  return [
    ...AI_KINDS.map((kind) => ({
      id: kind,
      text: MODEL_DATA.line(MODEL_DATA.features[kind], kindLabels(kind, COPY[kind])),
    })),
    { id: 'notes', text: MODEL_DATA.notes },
  ];
}
