import { applicationIdSchema } from '@jobflow/shared';
import { defaultFilter } from 'cmdk';

import { swapLayout } from '@/shared/lib/keyboard-layout';

const FOUND_BY_SERVER = 0.5;

function swappedScore(text: string, search: string): number {
  const swapped = swapLayout(search);
  return text.toLowerCase().includes(swapped) ? defaultFilter(text, swapped) : 0;
}

export function paletteFilter(...args: Parameters<typeof defaultFilter>): number {
  const [value, search, keywords] = args;
  if (applicationIdSchema.safeParse(value).success) return FOUND_BY_SERVER;
  const text = keywords?.join(' ') ?? value;
  const raw = defaultFilter(text, search);
  return raw > 0 ? raw : swappedScore(text, search);
}
