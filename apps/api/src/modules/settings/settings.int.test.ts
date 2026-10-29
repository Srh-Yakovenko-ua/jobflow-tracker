import {
  meResponseSchema,
  type RejectionReasonCode,
  settingsSuggestionsSchema,
  type Stage,
  userSettingsSchema,
} from '@jobflow/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { USER_SETTINGS_SELECT } from '../../prisma/user-settings-row.js';
import { useTestApp } from '../../test/app.js';
import { type SignedInSearcher, signedInWithSearch } from '../../test/applications.js';
import {
  type ApplicationRowInput,
  compensationOf,
  createApplicationRows,
  createStageEvent,
  createStageEvents,
  NEW_USER_SETTINGS,
  NEW_USER_SETTINGS_ROW,
  seedRejectionReasons,
} from '../../test/factories.js';
import { callRoute, errorPathsOf, type RouteCall } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';
import { daysBefore } from '../../test/time.js';

type Answer = { toStage: Stage; waitDays: number; reasonCode?: RejectionReasonCode };

type AnsweredApplication = Omit<ApplicationRowInput, 'lastEventAt'> & { answers: Answer[] };

const SETTINGS_PATH = '/api/v1/settings';

const SUGGESTIONS_PATH = `${SETTINGS_PATH}/suggestions`;

const APPLIED_DAYS_AGO = 40;

const APPLIED_AT = daysBefore(APPLIED_DAYS_AGO);

const CHANGE = {
  silenceDays: 21,
  autoGhostDays: null,
  timezone: 'America/New_York',
  quietHoursStart: '21:15',
};

const CHANGED_FIELDS = ['silenceDays', 'autoGhostDays', 'timezone', 'quietHoursStart'];

const ANSWERED_FOUR: AnsweredApplication[] = [
  { answers: [{ toStage: 'screening', waitDays: 2 }] },
  { answers: [{ toStage: 'tech_interview', waitDays: 4 }] },
  {
    answers: [
      { toStage: 'screening', waitDays: 6.5 },
      { toStage: 'tech_interview', waitDays: 9 },
    ],
  },
  { answers: [{ toStage: 'rejected', waitDays: 8, reasonCode: 'skills_gap' }] },
];

const ANSWERED_FIFTH: AnsweredApplication = {
  answers: [{ toStage: 'screening', waitDays: 20 }],
};

const NOT_ANSWERED: AnsweredApplication[] = [
  { answers: [{ toStage: 'ghosted', waitDays: 1 }] },
  { answers: [{ toStage: 'withdrawn', waitDays: 1 }] },
  { answers: [{ toStage: 'rejected', waitDays: 1, reasonCode: 'accepted_other' }] },
  { isDraft: true, answers: [{ toStage: 'screening', waitDays: 1 }] },
  { deletedAt: daysBefore(1), answers: [{ toStage: 'screening', waitDays: 1 }] },
  { appliedAt: null, answers: [{ toStage: 'screening', waitDays: 1 }] },
];

const INVALID_CHANGES = [
  { case: 'silenceDays 31', body: { silenceDays: 31 }, path: 'silenceDays' },
  { case: 'silenceDays 2', body: { silenceDays: 2 }, path: 'silenceDays' },
  { case: 'autoGhostDays 13', body: { autoGhostDays: 13 }, path: 'autoGhostDays' },
  { case: 'autoGhostDays 91', body: { autoGhostDays: 91 }, path: 'autoGhostDays' },
  {
    case: 'the unknown time zone Mars/Phobos',
    body: { timezone: 'Mars/Phobos' },
    path: 'timezone',
  },
  { case: 'the offset +03:00', body: { timezone: '+03:00' }, path: 'timezone' },
  { case: 'an empty body', body: {}, path: '' },
];

describe('the settings routes', () => {
  const testApp = useTestApp();

  beforeAll(() => seedRejectionReasons(testApp.prisma));

  const call = (route: RouteCall) => callRoute(testApp.app, route);

  const patchSettings = ({ accessToken }: SignedInSearcher, body: object) =>
    call({ method: 'patch', path: SETTINGS_PATH, body, accessToken });

  const settingsOf = async ({ accessToken }: SignedInSearcher) =>
    userSettingsSchema.parse(
      (await call({ method: 'get', path: SETTINGS_PATH, accessToken })).body,
    );

  const suggestionsOf = async ({ accessToken }: SignedInSearcher) =>
    settingsSuggestionsSchema.parse(
      (await call({ method: 'get', path: SUGGESTIONS_PATH, accessToken })).body,
    );

  const storedRow = ({ userId }: SignedInSearcher) =>
    testApp.prisma.userSettings.findUniqueOrThrow({
      where: { userId },
      select: USER_SETTINGS_SELECT,
    });

  const settingsChangedRows = () => outboxRows(testApp.prisma, { eventType: 'settings.changed' });

  async function createAnswered(
    { userId, searchId }: SignedInSearcher,
    { answers, ...row }: AnsweredApplication,
  ): Promise<string> {
    const [applicationId = ''] = await createApplicationRows(testApp.prisma, {
      userId,
      searchId,
      rows: [{ appliedAt: APPLIED_AT, lastEventAt: APPLIED_AT, ...row }],
    });
    await createStageEvents(
      testApp.prisma,
      answers.map(({ waitDays, ...answer }) => ({
        ...answer,
        applicationId,
        occurredAt: daysBefore(APPLIED_DAYS_AGO - waitDays),
      })),
    );
    return applicationId;
  }

  async function createUndoneAnswer(owner: SignedInSearcher): Promise<void> {
    const applicationId = await createAnswered(owner, { answers: [] });
    const compensatesEventId = await createStageEvent(testApp.prisma, applicationId);
    await createStageEvents(testApp.prisma, [
      compensationOf({ applicationId, compensatesEventId }),
    ]);
  }

  async function createAnsweredAll(owner: SignedInSearcher, applications: AnsweredApplication[]) {
    await Promise.all(applications.map((application) => createAnswered(owner, application)));
  }

  it('GET answers the stored settings, the same as /auth/me', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    const me = await call({
      method: 'get',
      path: '/api/v1/auth/me',
      accessToken: olena.accessToken,
    });

    expect(await settingsOf(olena)).toEqual(NEW_USER_SETTINGS);
    expect(meResponseSchema.parse(me.body).settings).toEqual(NEW_USER_SETTINGS);
  });

  it('PATCH writes the sent fields, answers 200 with the new settings and records one settings.changed', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    const response = await patchSettings(olena, CHANGE);

    expect(response.status).toBe(200);
    expect(userSettingsSchema.parse(response.body)).toEqual({ ...NEW_USER_SETTINGS, ...CHANGE });
    expect(await storedRow(olena)).toEqual({
      ...NEW_USER_SETTINGS_ROW,
      ...CHANGE,
      quietHoursStart: new Date('1970-01-01T21:15:00.000Z'),
    });
    expect(await settingsChangedRows()).toEqual([
      {
        aggregate: 'settings',
        aggregateId: olena.userId,
        eventType: 'settings.changed',
        payload: { userId: olena.userId, fields: CHANGED_FIELDS },
      },
    ]);
  });

  it.each(['UTC', 'Europe/Kyiv'])('PATCH accepts the IANA time zone %s', async (timezone) => {
    const olena = await signedInWithSearch(testApp.prisma);

    const response = await patchSettings(olena, { timezone });

    expect([response.status, userSettingsSchema.parse(response.body).timezone]).toEqual([
      200,
      timezone,
    ]);
  });

  it.each(INVALID_CHANGES)(
    'PATCH answers $case with 422 at its field, keeps the row and records no event',
    async ({ body, path }) => {
      const olena = await signedInWithSearch(testApp.prisma);

      const response = await patchSettings(olena, body);

      expect([response.status, errorPathsOf(response.body)]).toEqual([422, [path]]);
      expect(await storedRow(olena)).toEqual(NEW_USER_SETTINGS_ROW);
      expect(await settingsChangedRows()).toEqual([]);
    },
  );

  it("BOHDAN's PATCH changes only his own row and OLENA still reads hers", async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);

    const response = await patchSettings(bohdan, { silenceDays: 30 });

    expect(userSettingsSchema.parse(response.body).silenceDays).toBe(30);
    expect(await storedRow(olena)).toEqual(NEW_USER_SETTINGS_ROW);
    expect(await settingsOf(olena)).toEqual(NEW_USER_SETTINGS);
  });

  it('answers every settings route without a token with 401', async () => {
    const routes: RouteCall[] = [
      { method: 'get', path: SETTINGS_PATH },
      { method: 'patch', path: SETTINGS_PATH, body: { silenceDays: 10 } },
      { method: 'get', path: SUGGESTIONS_PATH },
    ];

    const responses = await Promise.all(routes.map(call));

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401]);
    expect(await settingsChangedRows()).toEqual([]);
  });

  it('GET suggestions falls back to 7 days with no median for 4 answered applications', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    await createAnsweredAll(olena, ANSWERED_FOUR);

    expect(await suggestionsOf(olena)).toEqual({
      silenceDays: 7,
      medianResponseDays: null,
      answeredApplications: 4,
    });
  });

  it('GET suggestions takes one day over the whole median of the first company answers of 5 applications', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    await createAnsweredAll(olena, [...ANSWERED_FOUR, ANSWERED_FIFTH, ...NOT_ANSWERED]);
    await createUndoneAnswer(olena);
    await createAnswered(bohdan, { answers: [{ toStage: 'screening', waitDays: 1 }] });

    expect(await suggestionsOf(olena)).toEqual({
      silenceDays: 7,
      medianResponseDays: 6,
      answeredApplications: 5,
    });
    expect(await suggestionsOf(bohdan)).toEqual({
      silenceDays: 7,
      medianResponseDays: null,
      answeredApplications: 1,
    });
  });
});
