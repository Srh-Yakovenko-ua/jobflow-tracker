import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type SendMailOptions } from 'nodemailer';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import type { Env } from '../../config/env.js';

export const EMAIL_SENDER = { from: 'JobFlow <noreply@jobflow.local>' } as const;

export type SmtpTransportInput = { url: string; timeoutMs: number };

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
};

export function smtpTransport({ url, timeoutMs }: SmtpTransportInput) {
  return createTransport({
    url,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });
}

export const mailOf = ({ unsubscribeUrl, ...email }: OutgoingEmail): SendMailOptions => ({
  ...email,
  from: EMAIL_SENDER.from,
  list: { unsubscribe: unsubscribeUrl },
});

@Injectable()
export class EmailSender {
  private readonly transport: ReturnType<typeof smtpTransport>;

  constructor(config: ConfigService<Env, true>) {
    this.transport = smtpTransport({
      url: config.get('SMTP_URL', { infer: true }),
      timeoutMs: DEPENDENCY_LIMITS.smtpTimeoutMs,
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    await this.transport.sendMail(mailOf(email));
  }
}
