import type { RejectionReason } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export type RejectionReasonRow = RejectionReason & { code: string };

@Injectable()
export class SeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertRejectionReasons(rows: RejectionReasonRow[]): Promise<number> {
    const upserted = await this.prisma.$transaction(
      rows.map(({ code, ...fields }) =>
        this.prisma.rejectionReason.upsert({
          where: { code },
          create: { code, ...fields },
          update: fields,
        }),
      ),
    );
    return upserted.length;
  }

  async hasUser(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0;
  }
}
