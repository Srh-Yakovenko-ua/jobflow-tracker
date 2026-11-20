import type { TimelineItem } from '@jobflow/shared';

export type Folded = { parsed: TimelineItem | undefined; confirmed: TimelineItem | undefined };

export function foldedOf(items: readonly TimelineItem[]): Folded {
  if (!items.some((item) => item.type === 'captured')) {
    return { parsed: undefined, confirmed: undefined };
  }
  return {
    parsed: items.filter((item) => item.type === 'ai_parsed').at(-1),
    confirmed: items.find((item) => item.type === 'draft_confirmed'),
  };
}
