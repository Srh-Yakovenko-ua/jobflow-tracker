import type { CvHintsResponse } from '@jobflow/shared';

import { type AiResultView, aiResultViewOf } from '@/entities/application';

export type CvHintsResult = NonNullable<CvHintsResponse['result']>;

export type CvHintsView = AiResultView<CvHintsResult>;

export type CvHintsViewInput = Readonly<{ response: CvHintsResponse; refused: boolean }>;

export function cvHintsViewOf(input: CvHintsViewInput): CvHintsView {
  return aiResultViewOf(input);
}
