import {
  applicationIdSchema,
  capturePasteInputSchema,
  VACANCY_PARSE_LIMITS,
} from '@jobflow/shared';

type QueryValue = string | string[] | undefined;

export type AddQuery = Readonly<{
  url?: QueryValue;
  text?: QueryValue;
  path?: QueryValue;
  review?: QueryValue;
}>;

export type AddPrefill = Readonly<{
  text: string;
  url: string;
  focusPaste: boolean;
  reviewId: string | null;
}>;

const PASTE_PATH = 'paste';

function textOf(value: QueryValue): string {
  return typeof value === 'string' ? value.slice(0, VACANCY_PARSE_LIMITS.textMaxLength) : '';
}

function urlOf(value: QueryValue): string {
  const parsed = capturePasteInputSchema.shape.url.safeParse(value);
  return parsed.success ? (parsed.data ?? '') : '';
}

export function addPrefillOf(query: AddQuery): AddPrefill {
  const text = textOf(query.text);
  const url = urlOf(query.url);
  const reviewId = applicationIdSchema.safeParse(query.review).data ?? null;
  const pasteAsked = query.path === PASTE_PATH || text !== '' || url !== '';
  return { text, url, focusPaste: pasteAsked && reviewId === null, reviewId };
}
