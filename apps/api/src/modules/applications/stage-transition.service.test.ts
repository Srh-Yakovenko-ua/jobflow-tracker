import type { MoveApplicationInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, RecordedEvents } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  APPLICATION_ROW,
  APPLIED_STATE,
  MISSING_TARGETS,
  MOVE_EVENT_ID,
  MOVE_TO_SCREENING_PLAN,
  MOVED_TO_SCREENING_STATE,
  OLENA_ID,
  type Target,
  TO_SCREENING,
  UNDO_OF_SCREENING_PLAN,
} from '../../test/service-fixtures.js';
import { NOW, PAST_UNDO_WINDOW, UNDO_WINDOW_END } from '../../test/time.js';
import {
  type ApplicationById,
  type ApplicationRow,
  ApplicationsRepository,
  type RecordApplicationEvent,
} from './applications.repository.js';
import {
  type ApplyStageEvent,
  type StageState,
  StageTransitionRepository,
} from './stage-transition.repository.js';
import { StageTransitionService } from './stage-transition.service.js';

type ServiceSetup = { state?: StageState; now?: Date };

class FakeStageTransitionRepository {
  readonly locks: ByUser<ApplicationById>[] = [];
  readonly applied: ByUser<ApplyStageEvent>[] = [];

  constructor(private readonly state: StageState) {}

  lockOwned(userId: string, input: ApplicationById): Promise<boolean> {
    this.locks.push({ userId, ...input });
    return Promise.resolve(this.ownedState({ userId, id: input.id }) !== null);
  }

  findStageState(userId: string, { id }: ApplicationById): Promise<StageState | null> {
    return Promise.resolve(this.ownedState({ userId, id }));
  }

  applyStageEvent(userId: string, input: ApplyStageEvent): Promise<ApplicationRow> {
    this.applied.push({ userId, ...input });
    const { event, lastEventAt } = input;
    return Promise.resolve({ ...APPLICATION_ROW, currentStage: event.toStage, lastEventAt });
  }

  private ownedState({ userId, id }: Target): StageState | null {
    return userId === OLENA_ID && id === APPLICATION_ID ? this.state : null;
  }
}

async function serviceWith({ state = APPLIED_STATE, now = NOW }: ServiceSetup = {}) {
  const transitions = new FakeStageTransitionRepository(state);
  const applications = new RecordedEvents<RecordApplicationEvent>();
  const moduleRef = await fakeTransactionModule({
    providers: [StageTransitionService, StageTransitionRepository, ApplicationsRepository],
    now,
  })
    .overrideProvider(StageTransitionRepository)
    .useValue(transitions)
    .overrideProvider(ApplicationsRepository)
    .useValue(applications)
    .compile();
  return { transitions, applications, service: moduleRef.get(StageTransitionService) };
}

const OWNER_ONLY_CALLS = [
  {
    method: 'move',
    call: (service: StageTransitionService, { userId, id }: Target) =>
      service.move(userId, { id, input: TO_SCREENING }),
  },
  {
    method: 'undoLast',
    call: (service: StageTransitionService, { userId, id }: Target) => service.undoLast(userId, id),
  },
];

describe.each(OWNER_ONLY_CALLS)('StageTransitionService.$method', ({ call }) => {
  it.each(MISSING_TARGETS)('answers $case with 404 and writes nothing', async (target) => {
    const { transitions, applications, service } = await serviceWith({
      state: MOVED_TO_SCREENING_STATE,
    });

    await expect(call(service, target)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect([transitions.applied, applications.events]).toEqual([[], []]);
  });
});

describe('StageTransitionService.move', () => {
  it('locks the application, then writes the event, the projection and application.stage_changed in the one transaction', async () => {
    const { transitions, applications, service } = await serviceWith();

    const response = await service.move(OLENA_ID, { id: APPLICATION_ID, input: TO_SCREENING });

    expect(transitions.locks).toEqual([
      { userId: OLENA_ID, id: APPLICATION_ID, tx: FAKE_TRANSACTION },
    ]);
    expect(transitions.applied).toEqual([
      { userId: OLENA_ID, id: APPLICATION_ID, ...MOVE_TO_SCREENING_PLAN, tx: FAKE_TRANSACTION },
    ]);
    expect(applications.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'application.stage_changed',
          applicationId: APPLICATION_ID,
          fromStage: 'applied',
          toStage: 'screening',
          reasonCode: null,
          compensatesEventId: null,
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(response).toMatchObject({
      currentStage: 'screening',
      lastEventAt: '2026-10-22T09:00:00.000Z',
    });
  });

  it.each<{ case: string; input: MoveApplicationInput; error: object }>([
    {
      case: 'a stale fromStage with 409 conflict',
      input: { fromStage: 'screening', toStage: 'final' },
      error: { status: 409, type: 'conflict' },
    },
    {
      case: 'a move the stage machine forbids with 409 illegal_transition',
      input: { fromStage: 'applied', toStage: 'offer' },
      error: { status: 409, type: 'illegal_transition' },
    },
    {
      case: 'a rejection without a reason code with 422',
      input: { fromStage: 'applied', toStage: 'rejected' },
      error: { status: 422, type: 'validation_error' },
    },
  ])('refuses $case and writes nothing', async ({ input, error }) => {
    const { transitions, applications, service } = await serviceWith();

    await expect(service.move(OLENA_ID, { id: APPLICATION_ID, input })).rejects.toMatchObject({
      body: error,
    });
    expect([transitions.applied, applications.events]).toEqual([[], []]);
  });
});

describe('StageTransitionService.undoLast', () => {
  it('writes the compensation, restores the stage and lastEventAt and records compensatesEventId', async () => {
    const { transitions, applications, service } = await serviceWith({
      state: MOVED_TO_SCREENING_STATE,
      now: UNDO_WINDOW_END,
    });

    const response = await service.undoLast(OLENA_ID, APPLICATION_ID);

    expect(transitions.applied).toEqual([
      { userId: OLENA_ID, id: APPLICATION_ID, ...UNDO_OF_SCREENING_PLAN, tx: FAKE_TRANSACTION },
    ]);
    expect(applications.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'application.stage_changed',
          applicationId: APPLICATION_ID,
          fromStage: 'screening',
          toStage: 'applied',
          reasonCode: null,
          compensatesEventId: MOVE_EVENT_ID,
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(response).toMatchObject({
      currentStage: 'applied',
      lastEventAt: '2026-10-19T09:00:00.000Z',
    });
  });

  it('refuses an undo 10 001 ms after the move with 409 and writes nothing', async () => {
    const { transitions, applications, service } = await serviceWith({
      state: MOVED_TO_SCREENING_STATE,
      now: PAST_UNDO_WINDOW,
    });

    await expect(service.undoLast(OLENA_ID, APPLICATION_ID)).rejects.toMatchObject({
      body: { status: 409, type: 'conflict', detail: 'The undo window has passed' },
    });
    expect([transitions.applied, applications.events]).toEqual([[], []]);
  });
});
