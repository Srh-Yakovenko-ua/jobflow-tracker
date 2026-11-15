import {
  type ApplicationListItem,
  applicationListResponseSchema,
  DEMO_USER,
  noteListResponseSchema,
  PAGINATION_LIMITS,
  summaryResponseSchema,
} from '@jobflow/shared';
import type { APIRequestContext } from '@playwright/test';

import { loginToken } from './session';
import { apiUrl } from './stack';

export type DemoTargets = Readonly<{ applicationId: string; month: string }>;

type DemoHeaders = Readonly<{ Authorization: string }>;

type DemoPageRequest = Readonly<{
  request: APIRequestContext;
  headers: DemoHeaders;
  cursor: string | null;
}>;

async function demoHeaders(request: APIRequestContext): Promise<DemoHeaders> {
  return { Authorization: `Bearer ${await loginToken(request, DEMO_USER)}` };
}

export async function demoTargets(request: APIRequestContext): Promise<DemoTargets> {
  const headers = await demoHeaders(request);
  const list = await request.get(apiUrl('/applications'), { headers });
  const latest = await request.get(apiUrl('/summaries/latest'), { headers });
  const first = applicationListResponseSchema.parse(await list.json()).items[0];
  const { summary } = summaryResponseSchema.parse(await latest.json());
  if (first === undefined || summary === null) {
    throw new Error('the demo walks need the demo data: run pnpm demo:seed first');
  }
  return { applicationId: first.id, month: summary.month };
}

async function demoApplications({
  request,
  headers,
  cursor,
}: DemoPageRequest): Promise<ApplicationListItem[]> {
  const limit = { limit: PAGINATION_LIMITS.maxLimit };
  const params = cursor === null ? limit : { ...limit, cursor };
  const response = await request.get(apiUrl('/applications'), { headers, params });
  const page = applicationListResponseSchema.parse(await response.json());
  if (page.nextCursor === null) return page.items;
  const rest = await demoApplications({ request, headers, cursor: page.nextCursor });
  return [...page.items, ...rest];
}

export async function demoPrivateTexts(request: APIRequestContext): Promise<string[]> {
  const headers = await demoHeaders(request);
  const applications = await demoApplications({ request, headers, cursor: null });
  if (applications.length === 0) {
    throw new Error('the share card check needs the demo data: run pnpm demo:seed first');
  }
  const notes = await Promise.all(
    applications.map(async ({ id }) => {
      const response = await request.get(apiUrl(`/applications/${id}/notes`), { headers });
      return noteListResponseSchema.parse(await response.json()).items.map(({ body }) => body);
    }),
  );
  return [...applications.flatMap(({ company, position }) => [company, position]), ...notes.flat()];
}
