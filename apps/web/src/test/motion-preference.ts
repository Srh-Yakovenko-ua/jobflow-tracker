import { stubMediaQuery } from './media-query';

export type MotionPreference = 'reduce' | 'no-preference';

const REDUCE_QUERIES = ['(prefers-reduced-motion: reduce)', '(prefers-reduced-motion)'];

export function stubMotionPreference(next: MotionPreference): void {
  for (const query of REDUCE_QUERIES) stubMediaQuery({ query, matches: next === 'reduce' });
}
