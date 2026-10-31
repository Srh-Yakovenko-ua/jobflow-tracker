import {
  SCHEDULED_EVENT_KINDS,
  SCHEDULED_EVENT_STATUSES,
  type ScheduledEventStatus,
  type Stage,
  TERMINAL_STAGES,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { minutesAfter, NOW } from '../../test/time.js';
import {
  changeEffectOf,
  interviewDoneAt,
  scheduledEventTitle,
  statusChangeAllowed,
  suggestedStageAfter,
} from './scheduled-event-rules.js';

const ALLOWED_STATUS_CHANGES = [
  'planned->planned',
  'planned->done',
  'planned->cancelled',
  'done->done',
  'cancelled->planned',
  'cancelled->cancelled',
];

const STATUS_PAIRS = SCHEDULED_EVENT_STATUSES.flatMap((from) =>
  SCHEDULED_EVENT_STATUSES.map((to) => ({
    from,
    to,
    allowed: ALLOWED_STATUS_CHANGES.includes(`${from}->${to}`),
  })),
);

const slot = (status: ScheduledEventStatus, startsAt = minutesAfter(60)) => ({ status, startsAt });

const suggestionsAt = (stage: Stage) =>
  SCHEDULED_EVENT_KINDS.map((kind) => suggestedStageAfter(kind, stage));

describe('statusChangeAllowed', () => {
  it.each(STATUS_PAIRS)('answers $from -> $to with $allowed', ({ from, to, allowed }) => {
    expect(statusChangeAllowed(from, to)).toBe(allowed);
  });
});

describe('suggestedStageAfter', () => {
  it.each([
    { kind: 'screening_call', stage: 'screening', suggested: 'tech_interview' },
    { kind: 'tech_interview', stage: 'tech_interview', suggested: 'final' },
    { kind: 'final_interview', stage: 'final', suggested: 'offer' },
    { kind: 'offer_call', stage: 'offer', suggested: null },
    { kind: 'other', stage: 'screening', suggested: null },
    { kind: 'tech_interview', stage: 'rejected', suggested: null },
    { kind: 'screening_call', stage: 'final', suggested: null },
  ] as const)('suggests $suggested after a $kind at $stage', ({ kind, stage, suggested }) => {
    expect(suggestedStageAfter(kind, stage)).toBe(suggested);
  });

  it('never suggests a move out of a terminal stage', () => {
    expect(new Set(TERMINAL_STAGES.flatMap(suggestionsAt))).toEqual(new Set([null]));
  });
});

describe('scheduledEventTitle', () => {
  it('names the kind in Ukrainian and the company', () => {
    expect(scheduledEventTitle('tech_interview', 'Acme')).toBe("Техінтерв'ю · Acme");
  });
});

describe('interviewDoneAt', () => {
  it('dates a done interview at its end when the user marks it later', () => {
    const event = { startsAt: minutesAfter(-180), durationMin: 90 };

    expect(interviewDoneAt(event, NOW).toISOString()).toBe('2026-10-22T07:30:00.000Z');
  });

  it('dates a done interview at now when the user marks it before its planned end', () => {
    const event = { startsAt: minutesAfter(-30), durationMin: 90 };

    expect(interviewDoneAt(event, NOW)).toEqual(NOW);
  });
});

describe('changeEffectOf', () => {
  it.each([
    { case: 'planned -> done', before: slot('planned'), after: slot('done'), effect: 'completed' },
    {
      case: 'planned -> cancelled',
      before: slot('planned'),
      after: slot('cancelled'),
      effect: 'cancelled',
    },
    {
      case: 'cancelled -> planned',
      before: slot('cancelled'),
      after: slot('planned'),
      effect: 'replanned',
    },
    {
      case: 'a new start while planned',
      before: slot('planned'),
      after: slot('planned', minutesAfter(240)),
      effect: 'replanned',
    },
    {
      case: 'the same planned start',
      before: slot('planned'),
      after: slot('planned'),
      effect: 'none',
    },
    {
      case: 'a new start while cancelled',
      before: slot('cancelled'),
      after: slot('cancelled', minutesAfter(240)),
      effect: 'none',
    },
    {
      case: 'a new start once done',
      before: slot('done'),
      after: slot('done', minutesAfter(240)),
      effect: 'none',
    },
  ] as const)('answers $case with $effect', ({ before, after, effect }) => {
    expect(changeEffectOf(before, after)).toBe(effect);
  });
});
