import { applicationListResponseSchema, DEMO_USER, summaryResponseSchema } from '@jobflow/shared';
import type { APIRequestContext } from '@playwright/test';

import { loginToken } from './session';
import { apiUrl } from './stack';

export type DemoTargets = Readonly<{ applicationId: string; month: string }>;

export async function demoTargets(request: APIRequestContext): Promise<DemoTargets> {
  const headers = { Authorization: `Bearer ${await loginToken(request, DEMO_USER)}` };
  const list = await request.get(apiUrl('/applications'), { headers });
  const latest = await request.get(apiUrl('/summaries/latest'), { headers });
  const first = applicationListResponseSchema.parse(await list.json()).items[0];
  const { summary } = summaryResponseSchema.parse(await latest.json());
  if (first === undefined || summary === null) {
    throw new Error('the demo walks need the demo data: run pnpm demo:seed first');
  }
  return { applicationId: first.id, month: summary.month };
}
