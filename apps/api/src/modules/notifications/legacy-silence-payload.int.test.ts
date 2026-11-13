import { notificationListResponseSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from '../../test/app.js';
import { getWithQuery } from '../../test/applications.js';
import { accessTokenFor } from '../../test/auth.js';
import { createUser } from '../../test/factories.js';
import {
  createNotifications,
  NOTIFICATIONS_PATH,
  SILENCE_ITEM,
  SILENCE_PAYLOAD,
} from '../../test/notifications.js';

describe('silence notifications written before the grouped payload', () => {
  const testApp = useTestApp();

  it('lists a one-card silence row as a group of one beside a grouped row', async () => {
    const user = await createUser(testApp.prisma);
    await testApp.prisma.notification.create({
      data: { userId: user.id, type: 'silence', payload: SILENCE_ITEM },
      select: { id: true },
    });
    await createNotifications(testApp.prisma, { userId: user.id, readAt: [null] });

    const response = await getWithQuery(testApp.app, {
      path: NOTIFICATIONS_PATH,
      accessToken: await accessTokenFor(user),
      query: {},
    });

    expect(response.status).toBe(200);
    expect(notificationListResponseSchema.parse(response.body).items).toMatchObject([
      { type: 'silence', payload: SILENCE_PAYLOAD },
      { type: 'silence', payload: SILENCE_PAYLOAD },
    ]);
  });
});
