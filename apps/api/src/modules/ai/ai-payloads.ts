import type { AiKind, AiKindInput } from '@jobflow/shared';

export type VacancySource = { rawText: string };

type AiPayloadBuilders = { [Kind in AiKind]: (source: never) => AiKindInput<Kind> };

export const AI_PAYLOAD_BUILDERS = {
  vacancy_parse: (application: VacancySource) => ({ text: application.rawText }),
} satisfies AiPayloadBuilders;
