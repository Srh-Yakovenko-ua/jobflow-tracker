import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export type AiUsageRow = {
  day: string;
  kind: string;
  model: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  avgLatencyMs: number;
};

@Injectable()
export class AiUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  dailyUsage(): Promise<AiUsageRow[]> {
    return this.prisma.$queryRaw<AiUsageRow[]>`
      SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, kind, model,
        count(*)::int AS calls, sum(tokens_in)::int AS "tokensIn",
        sum(tokens_out)::int AS "tokensOut", round(avg(latency_ms))::int AS "avgLatencyMs"
      FROM ai_results
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3`;
  }
}
