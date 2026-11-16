import { errorResponseSchema, userSettingsSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from '../../test/app.js';
import { accessTokenFor, unsubscribeTokenFor, withFlippedSignatureByte } from '../../test/auth.js';
import { createUser } from '../../test/factories.js';
import { callRoute, errorPathsOf } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';

const UNSUBSCRIBE_PATH = '/api/v1/email/unsubscribe';

const ALL_ON = { emailMonthlySummary: true, emailSilence: true, emailInterviewPrep: true };

describe('POST /email/unsubscribe', () => {
  const testApp = useTestApp();

  const unsubscribe = (body: object) =>
    callRoute(testApp.app, { method: 'post', path: UNSUBSCRIBE_PATH, body });

  const emailSwitchesOf = (userId: string) =>
    testApp.prisma.userSettings.findUniqueOrThrow({
      where: { userId },
      select: { emailMonthlySummary: true, emailSilence: true, emailInterviewPrep: true },
    });

  const settingsChangedRows = () => outboxRows(testApp.prisma, { eventType: 'settings.changed' });

  it('turns off only that email type of the token owner without signing in and records settings.changed', async () => {
    const olena = await createUser(testApp.prisma);
    const bohdan = await createUser(testApp.prisma);

    const response = await unsubscribe({ token: await unsubscribeTokenFor(olena.id) });

    expect([response.status, response.body]).toEqual([200, { type: 'monthly_summary_ready' }]);
    const settings = await callRoute(testApp.app, {
      method: 'get',
      path: '/api/v1/settings',
      accessToken: await accessTokenFor(olena),
    });
    expect(userSettingsSchema.parse(settings.body)).toMatchObject({
      ...ALL_ON,
      emailMonthlySummary: false,
    });
    expect(await emailSwitchesOf(bohdan.id)).toEqual(ALL_ON);
    expect(await settingsChangedRows()).toEqual([
      {
        aggregate: 'settings',
        aggregateId: olena.id,
        eventType: 'settings.changed',
        payload: { userId: olena.id, fields: ['emailMonthlySummary'] },
      },
    ]);
  });

  it.each([
    {
      case: 'a tampered token',
      token: async (userId: string) => withFlippedSignatureByte(await unsubscribeTokenFor(userId)),
    },
    { case: 'an access token', token: (userId: string) => accessTokenFor({ id: userId }) },
  ])('answers $case with the 401 error body and changes nothing', async ({ token }) => {
    const olena = await createUser(testApp.prisma);

    const response = await unsubscribe({ token: await token(olena.id) });

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'unauthorized',
      status: 401,
      detail: 'Invalid unsubscribe link',
    });
    expect(await emailSwitchesOf(olena.id)).toEqual(ALL_ON);
    expect(await settingsChangedRows()).toEqual([]);
  });

  it('answers a body without a token with 422 at token', async () => {
    const response = await unsubscribe({ token: '' });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['token']]);
  });

  it('answers the token of a deleted user with 401 and records nothing', async () => {
    const gone = await createUser(testApp.prisma);
    const token = await unsubscribeTokenFor(gone.id);
    await testApp.prisma.user.delete({ where: { id: gone.id } });

    const response = await unsubscribe({ token });

    expect(response.status).toBe(401);
    expect(await settingsChangedRows()).toEqual([]);
  });
});
