'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { applicationAiQueryOptions, useAiSection } from '@/entities/application';

import type { MatchView } from '../lib/match-view';

export type ApplicationCvHintsInput = Readonly<{
  application: ApplicationResponse;
  match: MatchView | null;
}>;

const FULL_SCORE = 100;

function cvHintsShown(match: MatchView | null): boolean {
  return match?.kind === 'scored' && match.match.score < FULL_SCORE;
}

export function useApplicationCvHints({ application, match }: ApplicationCvHintsInput) {
  return useAiSection({
    query: applicationAiQueryOptions({ id: application.id, segment: 'cv-hints' }),
    shown: cvHintsShown(match),
  });
}
