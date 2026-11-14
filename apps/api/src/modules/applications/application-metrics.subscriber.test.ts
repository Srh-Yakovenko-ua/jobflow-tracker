import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { MetricsRegistry } from '../../metrics/metrics-registry.js';
import { samplesOf } from '../../test/metrics.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { ApplicationMetricsSubscriber } from './application-metrics.subscriber.js';
import type {
  ApplicationCreatedPayload,
  ApplicationStageChangedPayload,
} from './applications.events.js';

const CREATED = 'jobflow_applications_created_total';

const MOVES = 'jobflow_stage_moves_total';

const CREATED_PAYLOAD: ApplicationCreatedPayload = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
};

const TO_SCREENING: ApplicationStageChangedPayload = {
  ...CREATED_PAYLOAD,
  fromStage: 'applied',
  toStage: 'screening',
  reasonCode: null,
  compensatesEventId: null,
};

describe('ApplicationMetricsSubscriber', () => {
  const metrics = new MetricsRegistry();
  const { route } = useSubscribedRouter([
    ApplicationMetricsSubscriber,
    { provide: MetricsRegistry, useValue: metrics },
  ]);

  beforeEach(() => {
    metrics.registry.resetMetrics();
  });

  it('counts every application.created event', async () => {
    await route('application.created', CREATED_PAYLOAD);
    await route('application.created', CREATED_PAYLOAD);

    expect(await samplesOf(metrics, CREATED)).toEqual([{ labels: {}, value: 2 }]);
  });

  it('counts application.stage_changed by the stage left and the stage reached', async () => {
    await route('application.stage_changed', TO_SCREENING);
    await route('application.stage_changed', TO_SCREENING);
    await route('application.stage_changed', {
      ...TO_SCREENING,
      fromStage: 'screening',
      toStage: 'rejected',
      reasonCode: 'no_explanation',
    });

    expect(await samplesOf(metrics, MOVES)).toEqual([
      { labels: { from_stage: 'applied', to_stage: 'screening' }, value: 2 },
      { labels: { from_stage: 'screening', to_stage: 'rejected' }, value: 1 },
    ]);
  });

  it('counts nothing for application.updated', async () => {
    await route('application.updated', { ...CREATED_PAYLOAD, fields: ['company'] });

    expect(await samplesOf(metrics, CREATED)).toEqual([{ labels: {}, value: 0 }]);
    expect(await samplesOf(metrics, MOVES)).toEqual([]);
  });

  it('fails a stage change without its stages as unrecoverable and counts no move', async () => {
    await expect(route('application.stage_changed', CREATED_PAYLOAD)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(await samplesOf(metrics, MOVES)).toEqual([]);
  });
});
