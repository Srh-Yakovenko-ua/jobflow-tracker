import { buildMonthlySummaryOutput } from '@jobflow/shared/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type { PrismaService } from '../prisma/prisma.service.js';
import { type SignedInSearcher, signedInWithSearch } from './applications.js';
import { createAiJob, createAiResult } from './factories.js';
import { callRoute } from './http.js';
import { NOW } from './time.js';

export const SUMMARIES_PATH = '/api/v1/summaries';

export const PLANS_PATH = '/api/v1/plans';

export const planPath = (aiJobId: string) => `${SUMMARIES_PATH}/${aiJobId}/plan`;

export const planItemPath = (planId: string, itemId: string) =>
  `${PLANS_PATH}/${planId}/items/${itemId}`;

export const archive = (
  app: NestExpressApplication,
  { accessToken }: Pick<SignedInSearcher, 'accessToken'>,
) => callRoute(app, { method: 'get', path: SUMMARIES_PATH, accessToken });

export type SummaryOwner = SignedInSearcher & { aiJobId: string };

export async function summaryOwner(prisma: PrismaService): Promise<SummaryOwner> {
  const owner = await signedInWithSearch(prisma);
  const { userId } = owner;
  const output = buildMonthlySummaryOutput();
  const aiResultId = await createAiResult(prisma, { userId, kind: 'monthly_summary', output });
  const aiJobId = await createAiJob(prisma, {
    userId,
    kind: 'monthly_summary',
    status: 'done',
    aiResultId,
    createdAt: NOW,
    finishedAt: NOW,
  });
  return { ...owner, aiJobId };
}
