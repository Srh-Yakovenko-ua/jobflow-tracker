import {
  type ApplicationResponse,
  applicationResponseSchema,
  type createApplicationInputSchema,
} from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { z } from 'zod';

import type { ApplicationEvent } from '../modules/applications/index.js';
import { callRoute } from './http.js';

export const APPLICATIONS_PATH = '/api/v1/applications';

export type NewApplicationBody = z.input<typeof createApplicationInputSchema>;

export type ApplicationRequest<Body> = { accessToken: string; input: Body };

export const applicationPath = (id: string) => `${APPLICATIONS_PATH}/${id}`;

export function postApplication(
  app: NestExpressApplication,
  { accessToken, input }: ApplicationRequest<object>,
) {
  return callRoute(app, { method: 'post', path: APPLICATIONS_PATH, body: input, accessToken });
}

export async function createApplication(
  app: NestExpressApplication,
  options: ApplicationRequest<NewApplicationBody>,
): Promise<ApplicationResponse> {
  const response = await postApplication(app, options);
  return applicationResponseSchema.parse(response.body);
}

export function applicationEventRow({
  eventType,
  ...payload
}: ApplicationEvent & { userId: string }) {
  return { aggregate: 'application', aggregateId: payload.applicationId, eventType, payload };
}
