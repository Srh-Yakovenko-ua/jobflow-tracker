import type { ScheduledEventKind, Stage } from '@jobflow/shared';

export const DEFAULT_KIND: Readonly<Record<Stage, ScheduledEventKind>> = {
  applied: 'screening_call',
  screening: 'tech_interview',
  tech_interview: 'tech_interview',
  final: 'final_interview',
  offer: 'offer_call',
  rejected: 'other',
  ghosted: 'other',
  withdrawn: 'other',
};
