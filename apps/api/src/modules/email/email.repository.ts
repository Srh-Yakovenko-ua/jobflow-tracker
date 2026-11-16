import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { USER_SETTINGS_SELECT } from '../../prisma/user-settings-row.js';

export const EMAIL_RECIPIENT_SELECT = {
  email: true,
  settings: { select: USER_SETTINGS_SELECT },
} satisfies Prisma.UserSelect;

export type EmailRecipientRow = Prisma.UserGetPayload<{ select: typeof EMAIL_RECIPIENT_SELECT }>;

@Injectable()
export class EmailRepository {
  constructor(private readonly prisma: PrismaService) {}

  recipientOf(userId: string): Promise<EmailRecipientRow | null> {
    return this.prisma.user.findUnique({ where: { id: userId }, select: EMAIL_RECIPIENT_SELECT });
  }
}
