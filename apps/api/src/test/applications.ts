import {
  type ApplicationBoardResponse,
  applicationBoardResponseSchema,
  type ApplicationListResponse,
  applicationListResponseSchema,
  type ApplicationResponse,
  applicationResponseSchema,
  type createApplicationInputSchema,
} from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { z } from 'zod';

import type { ApplicationEvent } from '../modules/applications/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { accessTokenFor, OLENA, signUp, type SignUpInput } from './auth.js';
import { createSearch, createUser } from './factories.js';
import { callRoute } from './http.js';
import { NOW } from './time.js';

export const APPLICATIONS_PATH = '/api/v1/applications';

export const APPLICATIONS_BOARD_PATH = `${APPLICATIONS_PATH}/board`;

export type NewApplicationBody = z.input<typeof createApplicationInputSchema>;

export type ApplicationRequest<Body> = { accessToken: string; input: Body };

export type QueryString = Record<string, string>;

export type QueryRequest = { accessToken?: string | undefined; query?: QueryString };

export type PathQueryRequest = QueryRequest & { path: string };

export type SignedInSearcher = { userId: string; searchId: string; accessToken: string };

export type StageMoveRequest = ApplicationRequest<object> & { id: string };

export type UndoRequest = Omit<StageMoveRequest, 'input'>;

export type NoteTarget = { id: string; noteId: string };

export type SignedInApplication = { accessToken: string; id: string };

export const ROMASHKA = {
  company: 'Ромашка',
  position: 'Backend developer',
} satisfies NewApplicationBody;

const MAX_LIST_PAGES = 10;

export const applicationPath = (id: string) => `${APPLICATIONS_PATH}/${id}`;

export const stageEventsPath = (id: string) => `${applicationPath(id)}/events`;

export const timelinePath = (id: string) => `${applicationPath(id)}/timeline`;

export const notesPath = (id: string) => `${applicationPath(id)}/notes`;

export const notePath = ({ id, noteId }: NoteTarget) => `${notesPath(id)}/${noteId}`;

export function postStageMove(
  app: NestExpressApplication,
  { accessToken, id, input }: StageMoveRequest,
) {
  return callRoute(app, { method: 'post', path: stageEventsPath(id), body: input, accessToken });
}

export function undoLastMove(app: NestExpressApplication, { accessToken, id }: UndoRequest) {
  return callRoute(app, { method: 'post', path: `${stageEventsPath(id)}/undo-last`, accessToken });
}

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

export async function signUpWithApplication(
  app: NestExpressApplication,
  user: SignUpInput = OLENA,
): Promise<SignedInApplication> {
  const { accessToken } = await signUp(app, user);
  const { id } = await createApplication(app, { accessToken, input: ROMASHKA });
  return { accessToken, id };
}

export function getWithQuery(
  app: NestExpressApplication,
  { path, accessToken, query = {} }: PathQueryRequest,
) {
  const search = new URLSearchParams(query).toString();
  return callRoute(app, {
    method: 'get',
    path: search === '' ? path : `${path}?${search}`,
    accessToken,
  });
}

export async function listApplications(
  app: NestExpressApplication,
  request: QueryRequest,
): Promise<ApplicationListResponse> {
  const response = await getWithQuery(app, { ...request, path: APPLICATIONS_PATH });
  return applicationListResponseSchema.parse(response.body);
}

export async function listPages(
  app: NestExpressApplication,
  { accessToken, query = {} }: QueryRequest,
): Promise<ApplicationListResponse[]> {
  const pages: ApplicationListResponse[] = [];
  let cursor: string | null = null;
  do {
    const pageQuery = cursor === null ? query : { ...query, cursor };
    const page = await listApplications(app, { accessToken, query: pageQuery });
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor !== null && pages.length < MAX_LIST_PAGES);
  return pages;
}

export async function getApplicationBoard(
  app: NestExpressApplication,
  request: QueryRequest,
): Promise<ApplicationBoardResponse> {
  const response = await getWithQuery(app, { ...request, path: APPLICATIONS_BOARD_PATH });
  return applicationBoardResponseSchema.parse(response.body);
}

export async function signedInWithSearch(prisma: PrismaService): Promise<SignedInSearcher> {
  const user = await createUser(prisma);
  const searchId = await createSearch(prisma, { userId: user.id });
  return { userId: user.id, searchId, accessToken: await accessTokenFor(user) };
}

export const CREATION_EVENT_ROW = {
  fromStage: null,
  toStage: 'applied',
  reasonCode: null,
  occurredAt: NOW,
  compensatesEventId: null,
};

export function stageEventsOf(prisma: PrismaService, applicationId: string) {
  return prisma.stageEvent.findMany({
    where: { applicationId },
    orderBy: { id: 'asc' },
    select: {
      fromStage: true,
      toStage: true,
      reasonCode: true,
      occurredAt: true,
      compensatesEventId: true,
    },
  });
}

export function applicationEventRow({
  eventType,
  ...payload
}: ApplicationEvent & { userId: string }) {
  return { aggregate: 'application', aggregateId: payload.applicationId, eventType, payload };
}
