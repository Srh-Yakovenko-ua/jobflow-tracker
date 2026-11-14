import {
  type AiKind,
  type AiKindInput,
  type Application,
  type DocumentExtraction,
  matchProfileSchema,
  RESUME_PARSE_LIMITS,
  VACANCY_PARSE_LIMITS,
} from '@jobflow/shared';

import { followupPayload } from './followup-payload.js';
import { monthlySummaryPayload } from './monthly-summary-payload.js';

export type VacancySource = { rawText: string };

export type MatchInputSource = Pick<Application, 'position' | 'stack'> & {
  rawText: string | null;
  profile: unknown;
};

type AiPayloadBuilders = { [Kind in AiKind]: (source: never) => AiKindInput<Kind> };

const boundedText = (text: string, maxLength: number) =>
  text.replaceAll('\u0000', '').slice(0, maxLength).toWellFormed();

const vacancyTextOf = (rawText: string | null) => {
  const text = boundedText(rawText ?? '', VACANCY_PARSE_LIMITS.textMaxLength);
  return /\S/.test(text) ? text : '';
};

export const AI_PAYLOAD_BUILDERS = {
  vacancy_parse: (application: VacancySource) => ({ text: application.rawText }),
  resume_parse: ({ kind, text, pages }: DocumentExtraction) =>
    kind === 'text'
      ? { text: boundedText(text, RESUME_PARSE_LIMITS.textMaxLength), pages: [] }
      : { text: '', pages: pages.map((page) => page.jpegBase64) },
  match: ({ position, stack, rawText, profile }: MatchInputSource) => ({
    vacancy: { position, stack, text: vacancyTextOf(rawText) },
    profile: matchProfileSchema.parse(profile),
  }),
  followup: followupPayload,
  monthly_summary: monthlySummaryPayload,
} satisfies AiPayloadBuilders;
