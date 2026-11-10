import { capturePasteInputSchema, VACANCY_PARSE_LIMITS } from '@jobflow/shared';

type QueryValue = string | string[] | undefined;

export type AddQuery = Readonly<{ url?: QueryValue; text?: QueryValue; path?: QueryValue }>;

export type AddPrefill = Readonly<{ text: string; url: string; focusPaste: boolean }>;

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
  return { text, url, focusPaste: query.path === PASTE_PATH || text !== '' || url !== '' };
}
