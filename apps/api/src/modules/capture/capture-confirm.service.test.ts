import { describe, expect, it } from 'vitest';

import { conflict } from '../../common/app-error.js';
import { FakeApplicationDrafts } from '../../test/capture.js';
import { FAKE_TRANSACTION as tx, fakeTransactionModule } from '../../test/fake-prisma.js';
import { RecordingNotifications } from '../../test/notifications.js';
import { TimelineRecorder } from '../../test/recorded-events.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { TimelineService } from '../events/index.js';
import { NotificationsService } from '../notifications/index.js';
import { CaptureConfirmService } from './capture-confirm.service.js';

async function serviceWith() {
  const drafts = new FakeApplicationDrafts();
  const timeline = new TimelineRecorder();
  const notifications = new RecordingNotifications();
  const moduleRef = await fakeTransactionModule({
    providers: [
      CaptureConfirmService,
      { provide: ApplicationDraftsService, useValue: drafts },
      { provide: TimelineService, useValue: timeline },
      { provide: NotificationsService, useValue: notifications },
    ],
    now: NOW,
  }).compile();
  return { drafts, timeline, notifications, service: moduleRef.get(CaptureConfirmService) };
}

describe('CaptureConfirmService.confirm', () => {
  it('confirms the draft and records one draft_confirmed row at the confirm time in the transaction', async () => {
    const { drafts, timeline, service } = await serviceWith();

    await service.confirm(OLENA_ID, APPLICATION_ID);

    expect(drafts.confirmed).toEqual([{ userId: OLENA_ID, applicationId: APPLICATION_ID, tx }]);
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'draft_confirmed',
        payload: {},
        occurredAt: NOW,
        tx,
      },
    ]);
  });

  it('marks the vacancy parse notices of the draft read at the confirm time in the transaction', async () => {
    const { notifications, service } = await serviceWith();

    await service.confirm(OLENA_ID, APPLICATION_ID);

    expect(notifications.vacancyParsesRead).toEqual([
      { userId: OLENA_ID, applicationId: APPLICATION_ID, now: NOW, tx },
    ]);
  });

  it('records no timeline row and marks nothing read when the draft cannot be confirmed', async () => {
    const { drafts, timeline, notifications, service } = await serviceWith();
    drafts.refusal = conflict('Application is not a draft');

    await expect(service.confirm(OLENA_ID, APPLICATION_ID)).rejects.toMatchObject({
      body: { status: 409, detail: 'Application is not a draft' },
    });

    expect([timeline.events, notifications.vacancyParsesRead]).toEqual([[], []]);
  });
});
