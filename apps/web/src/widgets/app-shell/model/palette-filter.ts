import { defaultFilter } from 'cmdk';

import { FOUND_RESULT_PREFIX } from '@/features/search-applications';
import { swapLayout } from '@/shared/lib/keyboard-layout';

export const RECENT_VALUE_PREFIX = 'recent:';

const FOUND_BY_SERVER = 0.5;

function contiguousScore(text: string, search: string): number {
  return text.toLowerCase().includes(search.toLowerCase()) ? defaultFilter(text, search) : 0;
}

function recentScore(text: string, search: string): number {
  return contiguousScore(text, search) || contiguousScore(text, swapLayout(search));
}

export function paletteFilter(...args: Parameters<typeof defaultFilter>): number {
  const [value, search, keywords = []] = args;
  if (value.startsWith(FOUND_RESULT_PREFIX)) return FOUND_BY_SERVER;
  const text = keywords.length > 0 ? keywords.join(' ') : value;
  if (value.startsWith(RECENT_VALUE_PREFIX)) return recentScore(text, search);
  const raw = defaultFilter(text, search);
  return raw > 0 ? raw : contiguousScore(text, swapLayout(search));
}
