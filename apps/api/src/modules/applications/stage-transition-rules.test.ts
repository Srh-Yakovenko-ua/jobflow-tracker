import { canTransition, type MoveApplicationInput, type Stage, STAGES } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { AppError, type ErrorBody } from '../../common/app-error.js';
import {
  APPLIED_STATE,
  CREATION_EVENT,
  MOVE_EVENT_ID,
  MOVE_TO_SCREENING_EVENT,
  MOVE_TO_SCREENING_PLAN,
  MOVED_TO_SCREENING_STATE,
  TO_SCREENING,
  UNDO_OF_SCREENING_PLAN,
} from '../../test/service-fixtures.js';
import { NOW, PAST_UNDO_WINDOW, UNDO_WINDOW_END } from '../../test/time.js';
import type { StageState } from './stage-transition.repository.js';
import { plannedMove, plannedUndo } from './stage-transition-rules.js';

const STAGE_BEFORE_GHOSTED = 'screening' satisfies Stage;

function stateIn(stage: Stage): StageState {
  return {
    currentStage: stage,
    stageEvents: [
      { ...CREATION_EVENT, id: MOVE_EVENT_ID, fromStage: STAGE_BEFORE_GHOSTED, toStage: stage },
    ],
    user: { settings: { askRejectionReason: false } },
  };
}

function expectedRefusal(from: Stage, to: Stage) {
  const result = canTransition(from, to);
  if (!result.ok) {
    return result.reason;
  }
  return from === 'ghosted' && to !== STAGE_BEFORE_GHOSTED ? 'not_allowed' : null;
}

const PAIRS = STAGES.flatMap((from) =>
  STAGES.map((to) => ({ from, to, refusal: expectedRefusal(from, to) })),
);

const ALLOWED_PAIRS = PAIRS.filter(({ refusal }) => refusal === null);

const REFUSED_PAIRS = PAIRS.filter(({ refusal }) => refusal !== null);

function refusalOf(plan: () => unknown): ErrorBody | undefined {
  try {
    plan();
  } catch (error) {
    return error instanceof AppError ? error.body : undefined;
  }
  return undefined;
}

const moveFrom = (state: StageState, input: MoveApplicationInput) =>
  plannedMove({ state, input, now: NOW });

const fieldRefusal = (path: string, message: string) => ({
  status: 422,
  type: 'validation_error',
  errors: [{ path, message }],
});

describe('a move over the stage machine', () => {
  it('splits the 64 stage pairs into 23 allowed and 41 refused moves', () => {
    expect([PAIRS.length, ALLOWED_PAIRS.length, REFUSED_PAIRS.length]).toEqual([64, 23, 41]);
  });

  it.each(ALLOWED_PAIRS)('moves $from to $to', ({ from, to }) => {
    const plan = moveFrom(stateIn(from), { fromStage: from, toStage: to });

    expect(plan.event).toMatchObject({ fromStage: from, toStage: to });
  });

  it.each(REFUSED_PAIRS)('refuses $from to $to as $refusal', ({ from, to, refusal }) => {
    expect(refusalOf(() => moveFrom(stateIn(from), { fromStage: from, toStage: to }))).toEqual({
      status: 409,
      type: 'illegal_transition',
      title: 'Illegal stage transition',
      detail: `${from} -> ${to}: ${String(refusal)}`,
    });
  });

  it.each<{ from: Stage; to: Stage; detail: string }>([
    { from: 'offer', to: 'applied', detail: 'offer -> applied: not_allowed' },
    { from: 'rejected', to: 'screening', detail: 'rejected -> screening: terminal_stage' },
    { from: 'ghosted', to: 'final', detail: 'ghosted -> final: not_allowed' },
    { from: 'ghosted', to: 'applied', detail: 'ghosted -> applied: not_allowed' },
  ])('refuses $detail', ({ from, to, detail }) => {
    expect(
      refusalOf(() => moveFrom(stateIn(from), { fromStage: from, toStage: to })),
    ).toMatchObject({ status: 409, type: 'illegal_transition', detail });
  });

  it('revives a ghosted application entered from screening back to screening', () => {
    const plan = moveFrom(stateIn('ghosted'), { fromStage: 'ghosted', toStage: 'screening' });

    expect(plan.event).toMatchObject({ fromStage: 'ghosted', toStage: 'screening' });
  });

  it('refuses a fromStage the application has already left with 409 conflict', () => {
    expect(
      refusalOf(() =>
        moveFrom(APPLIED_STATE, { fromStage: 'screening', toStage: 'tech_interview' }),
      ),
    ).toMatchObject({
      status: 409,
      type: 'conflict',
      detail: 'The application is in applied, not screening',
    });
  });
});

describe('the time of a move', () => {
  it('records a move without occurredAt at now and sets lastEventAt to now', () => {
    expect(moveFrom(APPLIED_STATE, TO_SCREENING)).toEqual(MOVE_TO_SCREENING_PLAN);
  });

  it('keeps the comment sent with a move', () => {
    const comment = 'Рекрутерка написала в Telegram';

    expect(moveFrom(APPLIED_STATE, { ...TO_SCREENING, comment }).event.comment).toBe(comment);
  });

  it.each([
    { case: 'a backdated occurredAt', occurredAt: '2026-10-21T09:00:00.000Z' },
    { case: 'an occurredAt equal to the previous event', occurredAt: '2026-10-19T09:00:00.000Z' },
    { case: 'an occurredAt equal to now', occurredAt: '2026-10-22T09:00:00.000Z' },
  ])('keeps $case as the event time and lastEventAt', ({ occurredAt }) => {
    const plan = moveFrom(APPLIED_STATE, { ...TO_SCREENING, occurredAt });

    expect(plan.event).toMatchObject({ occurredAt: new Date(occurredAt), createdAt: NOW });
    expect(plan.lastEventAt).toEqual(new Date(occurredAt));
  });

  it.each([
    {
      case: 'one millisecond after now',
      occurredAt: '2026-10-22T09:00:00.001Z',
      message: 'occurredAt must not be in the future',
    },
    {
      case: 'one millisecond before the previous event',
      occurredAt: '2026-10-19T08:59:59.999Z',
      message: 'occurredAt must not be before the previous event at 2026-10-19T09:00:00.000Z',
    },
  ])('refuses an occurredAt $case with 422 on occurredAt', ({ occurredAt, message }) => {
    expect(refusalOf(() => moveFrom(APPLIED_STATE, { ...TO_SCREENING, occurredAt }))).toMatchObject(
      fieldRefusal('occurredAt', message),
    );
  });
});

describe('the rejection reason of a move', () => {
  it.each<{ case: string; state: StageState; input: MoveApplicationInput; reasonCode: string }>([
    {
      case: 'the sent code',
      state: APPLIED_STATE,
      input: { fromStage: 'applied', toStage: 'rejected', reasonCode: 'skills_gap' },
      reasonCode: 'skills_gap',
    },
    {
      case: 'unspecified sent while askRejectionReason is on',
      state: APPLIED_STATE,
      input: { fromStage: 'applied', toStage: 'rejected', reasonCode: 'unspecified' },
      reasonCode: 'unspecified',
    },
    {
      case: 'unspecified when askRejectionReason is off and no code is sent',
      state: { ...APPLIED_STATE, user: { settings: { askRejectionReason: false } } },
      input: { fromStage: 'applied', toStage: 'rejected' },
      reasonCode: 'unspecified',
    },
  ])('records $case on a move to rejected', ({ state, input, reasonCode }) => {
    expect(moveFrom(state, input).event.reasonCode).toBe(reasonCode);
  });

  it.each([
    { case: 'askRejectionReason is on', settings: { askRejectionReason: true } },
    { case: 'the user has no settings row', settings: null },
  ])(
    'refuses a move to rejected without a code when $case with 422 on reasonCode',
    ({ settings }) => {
      const state = { ...APPLIED_STATE, user: { settings } };

      expect(
        refusalOf(() => moveFrom(state, { fromStage: 'applied', toStage: 'rejected' })),
      ).toMatchObject(
        fieldRefusal(
          'reasonCode',
          'A move to rejected needs a reason code; send unspecified to skip it',
        ),
      );
    },
  );

  it.each<{ input: MoveApplicationInput; reasonCode: string | null }>([
    {
      input: { fromStage: 'applied', toStage: 'ghosted', reasonCode: 'silence_timeout' },
      reasonCode: 'silence_timeout',
    },
    { input: { fromStage: 'applied', toStage: 'withdrawn' }, reasonCode: null },
    { input: TO_SCREENING, reasonCode: null },
  ])('records $reasonCode on a move to $input.toStage', ({ input, reasonCode }) => {
    expect(moveFrom(APPLIED_STATE, input).event.reasonCode).toBe(reasonCode);
  });
});

describe('an undo of the last move', () => {
  it('compensates the latest move 10 000 ms after it with a move back and the previous lastEventAt', () => {
    expect(plannedUndo({ state: MOVED_TO_SCREENING_STATE, now: UNDO_WINDOW_END })).toEqual(
      UNDO_OF_SCREENING_PLAN,
    );
  });

  it('undoes a move to rejected although rejected is terminal', () => {
    const state: StageState = {
      ...MOVED_TO_SCREENING_STATE,
      currentStage: 'rejected',
      stageEvents: [{ ...MOVE_TO_SCREENING_EVENT, toStage: 'rejected' }, CREATION_EVENT],
    };

    expect(plannedUndo({ state, now: UNDO_WINDOW_END }).event).toMatchObject({
      fromStage: 'rejected',
      toStage: 'applied',
      compensatesEventId: MOVE_EVENT_ID,
    });
  });

  it('refuses an undo 10 001 ms after the move with 409 conflict', () => {
    expect(
      refusalOf(() => plannedUndo({ state: MOVED_TO_SCREENING_STATE, now: PAST_UNDO_WINDOW })),
    ).toMatchObject({ status: 409, type: 'conflict', detail: 'The undo window has passed' });
  });

  it.each([
    { case: 'only the creation event', stageEvents: [CREATION_EVENT] },
    { case: 'no stage event', stageEvents: [] },
  ])('refuses an undo with $case as nothing to undo', ({ stageEvents }) => {
    expect(
      refusalOf(() =>
        plannedUndo({ state: { ...APPLIED_STATE, stageEvents }, now: UNDO_WINDOW_END }),
      ),
    ).toMatchObject({ status: 409, type: 'conflict', detail: 'Nothing to undo' });
  });
});
