import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { describe, expect, it } from 'vitest';

import { validateEnv } from '../../config/env.js';
import { exampleEnv } from '../../test/example-env.js';
import { useSilentServers } from '../../test/silent-servers.js';
import { closedPortUrl } from '../../test/tcp-proxy.js';
import { EmailSender, mailOf, type OutgoingEmail, smtpTransport } from './email-sender.js';

const SHORT_LIMIT_MS = 300;

const EMAIL: OutgoingEmail = {
  to: 'olena@example.test',
  subject: 'Саммарі за вересень готове',
  html: '<p>Саммарі</p>',
  text: 'Саммарі',
  unsubscribeUrl: 'http://localhost:3000/unsubscribe?token=eyJ.payload.sig',
};

const smtpUrlOf = (httpUrl: string) => httpUrl.replace(/^http:/, 'smtp:');

const startClosedAfterTest = useSilentServers();

describe('EmailSender', () => {
  it('sends from JobFlow with a List-Unsubscribe header that points at the unsubscribe page', async () => {
    const stream = createTransport({ streamTransport: true, buffer: true });

    const { message } = await stream.sendMail(mailOf(EMAIL));

    const headers = Buffer.isBuffer(message) ? message.toString('utf8') : '';
    expect(headers).toContain('From: JobFlow <noreply@jobflow.local>');
    expect(headers).toContain(`List-Unsubscribe: <${EMAIL.unsubscribeUrl}>`);
  });

  it('rejects when the SMTP server refuses the connection', async () => {
    const url = smtpUrlOf(await closedPortUrl());
    const env = validateEnv({ ...exampleEnv, SMTP_URL: url });
    const sender = new EmailSender(new ConfigService(env));

    await expect(sender.send(EMAIL)).rejects.toThrow(/ECONNREFUSED/);
  });

  it('rejects within the limit when the SMTP server accepts and never greets', async () => {
    const silent = await startClosedAfterTest();
    const transport = smtpTransport({ url: smtpUrlOf(silent.url), timeoutMs: SHORT_LIMIT_MS });
    const startedAt = Date.now();

    await expect(transport.sendMail(mailOf(EMAIL))).rejects.toThrow(
      /^(Timeout|Greeting never received)$/,
    );

    expect(Date.now() - startedAt).toBeLessThan(SHORT_LIMIT_MS + 1000);
  });
});
