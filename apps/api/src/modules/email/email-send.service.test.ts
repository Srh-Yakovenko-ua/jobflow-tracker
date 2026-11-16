import type { Summary } from '@jobflow/shared';
import { buildSummary } from '@jobflow/shared/testing';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { validateEnv } from '../../config/env.js';
import type { UserSettingsRow } from '../../prisma/user-settings-row.js';
import { AI_JOB_ID } from '../../test/ai.js';
import { testJwtKeys } from '../../test/auth.js';
import { exampleEnv } from '../../test/example-env.js';
import { NEW_USER_SETTINGS_ROW } from '../../test/factories.js';
import { MONTHLY_SUMMARY_NOTIFICATION, NOTIFICATION_ID } from '../../test/notifications.js';
import { BOHDAN_ID, MISSING_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { fixedClock } from '../../test/time.js';
import { JwtKeys } from '../auth/index.js';
import { NotificationsService } from '../notifications/index.js';
import { SummariesService } from '../summaries/index.js';
import { EmailRepository } from './email.repository.js';
import { EmailComposeService } from './email-compose.service.js';
import { EmailSendService } from './email-send.service.js';
import { EmailSender, type OutgoingEmail } from './email-sender.js';
import { UnsubscribeTokens } from './unsubscribe-tokens.js';

const OLENA_EMAIL = 'olena@example.test';

const JOB = { userId: OLENA_ID, notificationId: NOTIFICATION_ID };

const SUMMARY: Summary = buildSummary({ aiJobId: AI_JOB_ID, month: '2026-09' });

class RecordingEmailSender {
  readonly sent: OutgoingEmail[] = [];

  failure: Error | null = null;

  send(email: OutgoingEmail): Promise<void> {
    if (this.failure !== null) return Promise.reject(this.failure);
    this.sent.push(email);
    return Promise.resolve();
  }
}

type SendSetup = { settings?: Partial<UserSettingsRow> };

const isOlena = (userId: string) => userId === OLENA_ID;

const notifications = {
  find: (userId: string, id: string) =>
    Promise.resolve(
      isOlena(userId) && id === NOTIFICATION_ID ? MONTHLY_SUMMARY_NOTIFICATION : undefined,
    ),
};

const summaries = {
  find: (userId: string, aiJobId: string) =>
    Promise.resolve(isOlena(userId) && aiJobId === AI_JOB_ID ? SUMMARY : null),
};

const recipientsWith = (settings: Partial<UserSettingsRow>) => ({
  recipientOf: (userId: string) =>
    Promise.resolve(
      isOlena(userId)
        ? { email: OLENA_EMAIL, settings: { ...NEW_USER_SETTINGS_ROW, ...settings } }
        : null,
    ),
});

async function sendWith({ settings = {} }: SendSetup = {}) {
  const sender = new RecordingEmailSender();
  const moduleRef = await Test.createTestingModule({
    providers: [
      EmailSendService,
      EmailComposeService,
      UnsubscribeTokens,
      { provide: JwtKeys, useValue: testJwtKeys },
      { provide: EmailSender, useValue: sender },
      { provide: Clock, useValue: fixedClock(new Date()) },
      { provide: ConfigService, useValue: new ConfigService(validateEnv(exampleEnv)) },
      { provide: NotificationsService, useValue: notifications },
      { provide: EmailRepository, useValue: recipientsWith(settings) },
      { provide: SummariesService, useValue: summaries },
    ],
  }).compile();
  return { sender, service: moduleRef.get(EmailSendService) };
}

const tokenOf = ({ unsubscribeUrl }: OutgoingEmail) =>
  new URL(unsubscribeUrl).searchParams.get('token') ?? '';

describe('EmailSendService.send', () => {
  it('emails the summary text to the user with a signed unsubscribe link of its type', async () => {
    const { sender, service } = await sendWith();

    await expect(service.send(JOB)).resolves.toBe('sent');

    const [email] = sender.sent;
    expect(email).toMatchObject({ to: OLENA_EMAIL, subject: 'Саммарі за вересень готове' });
    expect(email?.text).toContain(SUMMARY.text);
    expect(email?.unsubscribeUrl).toMatch(/^http:\/\/localhost:3000\/unsubscribe\?token=/);
    await expect(
      new UnsubscribeTokens(testJwtKeys).verify(email === undefined ? '' : tokenOf(email)),
    ).resolves.toEqual({ userId: OLENA_ID, type: 'monthly_summary_ready' });
  });

  it.each([
    { case: 'email was turned off', settings: { notifyEmail: false } },
    { case: 'summary emails were unsubscribed', settings: { emailMonthlySummary: false } },
  ])('sends nothing when $case after the email was queued', async ({ settings }) => {
    const { sender, service } = await sendWith({ settings });

    await expect(service.send(JOB)).resolves.toBe('skipped');

    expect(sender.sent).toEqual([]);
  });

  it.each([
    { case: 'a notification that is gone', job: { ...JOB, notificationId: MISSING_ID } },
    { case: 'a notification of another user', job: { ...JOB, userId: BOHDAN_ID } },
  ])('sends nothing for $case', async ({ job }) => {
    const { sender, service } = await sendWith();

    await expect(service.send(job)).resolves.toBe('skipped');

    expect(sender.sent).toEqual([]);
  });

  it('rejects so the job retries when the SMTP send fails', async () => {
    const { sender, service } = await sendWith();
    sender.failure = new Error('Timeout');

    await expect(service.send(JOB)).rejects.toThrow('Timeout');
  });
});
