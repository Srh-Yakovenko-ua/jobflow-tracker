import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { DEPENDENCY_LIMITS, isAnswered } from '../common/probe.js';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        connectionTimeoutMillis: DEPENDENCY_LIMITS.connectTimeoutMs,
        query_timeout: DEPENDENCY_LIMITS.queryTimeoutMs,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect().catch((error: unknown) => {
      this.logger.warn(`Postgres connection error: ${String(error)}`);
    });
  }

  async isUp(): Promise<boolean> {
    return isAnswered(this.$queryRaw`SELECT 1`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
