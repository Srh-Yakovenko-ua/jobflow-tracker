import {
  canTransition,
  SCHEDULED_EVENT_KIND_LABELS,
  type ScheduledEventKind,
  type ScheduledEventStatus,
  type Stage,
} from '@jobflow/shared';

import { addMinutes } from '../../common/add-minutes.js';

export type ScheduledEventSlot = { status: ScheduledEventStatus; startsAt: Date };

export type ChangeEffect = 'completed' | 'cancelled' | 'replanned' | 'none';

export type TimedEvent = { startsAt: Date; durationMin: number };

const STATUS_MOVES: Record<ScheduledEventStatus, readonly ScheduledEventStatus[]> = {
  planned: ['done', 'cancelled'],
  cancelled: ['planned'],
  done: [],
};

const NEXT_STAGE_AFTER: Record<ScheduledEventKind, Stage | null> = {
  screening_call: 'tech_interview',
  tech_interview: 'final',
  final_interview: 'offer',
  offer_call: null,
  other: null,
};

const EFFECT_OF_NEW_STATUS: Record<ScheduledEventStatus, ChangeEffect> = {
  done: 'completed',
  cancelled: 'cancelled',
  planned: 'replanned',
};

export function statusChangeAllowed(from: ScheduledEventStatus, to: ScheduledEventStatus) {
  return from === to || STATUS_MOVES[from].includes(to);
}

export function suggestedStageAfter(kind: ScheduledEventKind, currentStage: Stage): Stage | null {
  const next = NEXT_STAGE_AFTER[kind];
  return next !== null && canTransition(currentStage, next).ok ? next : null;
}

export function scheduledEventTitle(kind: ScheduledEventKind, company: string): string {
  return `${SCHEDULED_EVENT_KIND_LABELS[kind].labelUk} · ${company}`;
}

export function interviewDoneAt({ startsAt, durationMin }: TimedEvent, now: Date): Date {
  const end = addMinutes(startsAt, durationMin);
  return end < now ? end : now;
}

export function changeEffectOf(
  before: ScheduledEventSlot,
  after: ScheduledEventSlot,
): ChangeEffect {
  if (before.status !== after.status) {
    return EFFECT_OF_NEW_STATUS[after.status];
  }
  const moved = before.startsAt.getTime() !== after.startsAt.getTime();
  return after.status === 'planned' && moved ? 'replanned' : 'none';
}
