import {
  type AiKind,
  type AiKindInput,
  type DocumentExtraction,
  RESUME_PARSE_LIMITS,
} from '@jobflow/shared';

export type VacancySource = { rawText: string };

type AiPayloadBuilders = { [Kind in AiKind]: (source: never) => AiKindInput<Kind> };

const resumeTextOf = (text: string) =>
  text.replaceAll('\u0000', '').slice(0, RESUME_PARSE_LIMITS.textMaxLength).toWellFormed();

export const AI_PAYLOAD_BUILDERS = {
  vacancy_parse: (application: VacancySource) => ({ text: application.rawText }),
  resume_parse: ({ kind, text, pages }: DocumentExtraction) =>
    kind === 'text'
      ? { text: resumeTextOf(text), pages: [] }
      : { text: '', pages: pages.map((page) => page.jpegBase64) },
} satisfies AiPayloadBuilders;
