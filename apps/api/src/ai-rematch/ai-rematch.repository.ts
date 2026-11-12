import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AiRematchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserId(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return user?.id ?? null;
  }
}
