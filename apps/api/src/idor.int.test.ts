import { applicationResponseSchema, errorResponseSchema, meResponseSchema } from '@jobflow/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './test/app.js';
import { applicationPath, createApplication, ROMASHKA } from './test/applications.js';
import { BOHDAN, OLENA, signUp } from './test/auth.js';
import { callRoute, type RouteCall } from './test/http.js';
import {
  activationPath,
  downloadPath,
  resumeLinkPath,
  resumeVersionPath,
  uploadResumeVersion,
} from './test/resumes.js';
import { TO_SCREENING } from './test/service-fixtures.js';

type OwnerOnlyCase = Omit<RouteCall, 'accessToken'> & { card: string; ownerStatus: number };

type VersionReach = {
  olenaVersion: string;
  bohdanVersion: string;
  olenaApplication: string;
  bohdanApplication: string;
};

type VersionOwnedCase = {
  route: string;
  reach: (ids: VersionReach) => Omit<RouteCall, 'accessToken'>;
  ownerStatus: number;
};

const OLENAS_NOTE = 'Нотатка Олени';

const FOREIGN_NOTE = { body: 'Чужа нотатка' };

const OLENAS_CONTACT = { name: 'Оксана Левченко', email: 'o.levchenko@acme.io' };

const FOREIGN_CONTACT = { name: 'Чужий рекрутер' };

const OLENAS_EVENT = {
  kind: 'tech_interview',
  startsAt: new Date('2026-11-03T14:00:00.000Z'),
  durationMin: 90,
  status: 'planned',
  outcomeNote: null,
} as const;

const FOREIGN_EVENT = { kind: 'screening_call', startsAt: '2026-11-04T10:00:00+02:00' };

const FOREIGN_EVENT_PATCH = { status: 'cancelled', outcomeNote: 'Чужа зміна' };

const OWNER_ONLY_CASES: OwnerOnlyCase[] = [
  { card: 'BE-14', method: 'get', path: '/applications/:id', ownerStatus: 200 },
  {
    card: 'BE-14',
    method: 'patch',
    path: '/applications/:id',
    body: { company: 'Чужа компанія' },
    ownerStatus: 200,
  },
  { card: 'BE-14', method: 'delete', path: '/applications/:id', ownerStatus: 204 },
  {
    card: 'BE-17',
    method: 'post',
    path: '/applications/:id/events',
    body: TO_SCREENING,
    ownerStatus: 201,
  },
  { card: 'BE-17', method: 'post', path: '/applications/:id/events/undo-last', ownerStatus: 409 },
  { card: 'BE-18', method: 'get', path: '/applications/:id/timeline', ownerStatus: 200 },
  {
    card: 'BE-22',
    method: 'post',
    path: '/applications/:id/notes',
    body: FOREIGN_NOTE,
    ownerStatus: 201,
  },
  { card: 'BE-22', method: 'get', path: '/applications/:id/notes', ownerStatus: 200 },
  {
    card: 'BE-22',
    method: 'patch',
    path: '/applications/:id/notes/:noteId',
    body: FOREIGN_NOTE,
    ownerStatus: 200,
  },
  { card: 'BE-22', method: 'delete', path: '/applications/:id/notes/:noteId', ownerStatus: 204 },
  {
    card: 'BE-21',
    method: 'post',
    path: '/applications/:id/contacts',
    body: FOREIGN_CONTACT,
    ownerStatus: 201,
  },
  { card: 'BE-21', method: 'get', path: '/applications/:id/contacts', ownerStatus: 200 },
  {
    card: 'BE-21',
    method: 'patch',
    path: '/applications/:id/contacts/:contactId',
    body: FOREIGN_CONTACT,
    ownerStatus: 200,
  },
  {
    card: 'BE-21',
    method: 'delete',
    path: '/applications/:id/contacts/:contactId',
    ownerStatus: 204,
  },
  {
    card: 'BE-23',
    method: 'post',
    path: '/applications/:id/scheduled-events',
    body: FOREIGN_EVENT,
    ownerStatus: 201,
  },
  { card: 'BE-23', method: 'get', path: '/applications/:id/scheduled-events', ownerStatus: 200 },
  {
    card: 'BE-23',
    method: 'patch',
    path: '/applications/:id/scheduled-events/:eventId',
    body: FOREIGN_EVENT_PATCH,
    ownerStatus: 200,
  },
  {
    card: 'BE-23',
    method: 'delete',
    path: '/applications/:id/scheduled-events/:eventId',
    ownerStatus: 204,
  },
  {
    card: 'BE-23',
    method: 'get',
    path: '/applications/:id/scheduled-events/:eventId/ics',
    ownerStatus: 200,
  },
];

const FOREIGN_VERSION_PATCH = { title: 'Чужа назва', note: 'Чужа примітка', isArchived: true };

const VERSION_OWNED_CASES: VersionOwnedCase[] = [
  {
    route: 'PATCH /resumes/versions/:id',
    reach: ({ olenaVersion }) => ({
      method: 'patch',
      path: resumeVersionPath(olenaVersion),
      body: FOREIGN_VERSION_PATCH,
    }),
    ownerStatus: 200,
  },
  {
    route: 'DELETE /resumes/versions/:id',
    reach: ({ olenaVersion }) => ({ method: 'delete', path: resumeVersionPath(olenaVersion) }),
    ownerStatus: 204,
  },
  {
    route: 'POST /resumes/versions/:id/activate',
    reach: ({ olenaVersion }) => ({ method: 'post', path: activationPath(olenaVersion) }),
    ownerStatus: 204,
  },
  {
    route: 'GET /resumes/versions/:id/download',
    reach: ({ olenaVersion }) => ({ method: 'get', path: downloadPath(olenaVersion) }),
    ownerStatus: 200,
  },
  {
    route: "PATCH /applications/:id/resume-version of his own application to OLENA's version",
    reach: ({ bohdanApplication, olenaVersion }) => ({
      method: 'patch',
      path: resumeLinkPath(bohdanApplication),
      body: { resumeVersionId: olenaVersion },
    }),
    ownerStatus: 204,
  },
  {
    route: "PATCH /applications/:id/resume-version of OLENA's application to his own version",
    reach: ({ olenaApplication, bohdanVersion }) => ({
      method: 'patch',
      path: resumeLinkPath(olenaApplication),
      body: { resumeVersionId: bohdanVersion },
    }),
    ownerStatus: 204,
  },
];

describe("another user's data", () => {
  const testApp = useTestApp();

  const http = () => request(testApp.app.getHttpServer());

  it("answers BOHDAN's GET /auth/me with BOHDAN's account while OLENA's exists", async () => {
    const olena = await signUp(testApp.app, OLENA);
    const bohdan = await signUp(testApp.app, BOHDAN);

    const response = await http()
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${bohdan.accessToken}`);

    expect(response.status).toBe(200);
    const { user } = meResponseSchema.parse(response.body);
    expect(user).toMatchObject({ id: bohdan.user.id, email: BOHDAN.email });
    expect(user.id).not.toBe(olena.user.id);
  });

  it.each(OWNER_ONLY_CASES)(
    "answers BOHDAN's $method $path on OLENA's application with 404 and leaves it as it was",
    async ({ method, path, body, ownerStatus }) => {
      const olena = await signUp(testApp.app, OLENA);
      const bohdan = await signUp(testApp.app, BOHDAN);
      const application = await createApplication(testApp.app, {
        accessToken: olena.accessToken,
        input: ROMASHKA,
      });
      const note = await testApp.prisma.note.create({
        data: { applicationId: application.id, body: OLENAS_NOTE },
        select: { id: true },
      });
      const contact = await testApp.prisma.contact.create({
        data: { applicationId: application.id, ...OLENAS_CONTACT },
        select: { id: true },
      });
      const event = await testApp.prisma.scheduledEvent.create({
        data: { applicationId: application.id, ...OLENAS_EVENT },
        select: { id: true },
      });
      const filled = path
        .replace(':id', application.id)
        .replace(':noteId', note.id)
        .replace(':contactId', contact.id)
        .replace(':eventId', event.id);
      const route = { method, path: `/api/v1${filled}`, body };

      const intruder = await callRoute(testApp.app, { ...route, accessToken: bohdan.accessToken });

      expect(intruder.status).toBe(404);
      expect(errorResponseSchema.parse(intruder.body).type).toBe('not_found');
      const afterwards = await callRoute(testApp.app, {
        method: 'get',
        path: applicationPath(application.id),
        accessToken: olena.accessToken,
      });
      expect(afterwards.status).toBe(200);
      expect(applicationResponseSchema.parse(afterwards.body)).toEqual(application);
      expect(
        await testApp.prisma.note.findUnique({ where: { id: note.id }, select: { body: true } }),
      ).toEqual({ body: OLENAS_NOTE });
      expect(
        await testApp.prisma.contact.findUnique({
          where: { id: contact.id },
          select: { name: true, email: true },
        }),
      ).toEqual(OLENAS_CONTACT);
      expect(
        await testApp.prisma.scheduledEvent.findMany({
          where: { applicationId: application.id },
          select: {
            kind: true,
            startsAt: true,
            durationMin: true,
            status: true,
            outcomeNote: true,
          },
        }),
      ).toEqual([OLENAS_EVENT]);
      const owner = await callRoute(testApp.app, { ...route, accessToken: olena.accessToken });
      expect(owner.status).toBe(ownerStatus);
    },
  );

  it.each(VERSION_OWNED_CASES)(
    "answers BOHDAN's $route with 404 and leaves OLENA's resume version and every link as it was",
    async ({ reach, ownerStatus }) => {
      const olena = await signUp(testApp.app, OLENA);
      const bohdan = await signUp(testApp.app, BOHDAN);
      const olenaApplication = await createApplication(testApp.app, {
        accessToken: olena.accessToken,
        input: ROMASHKA,
      });
      const bohdanApplication = await createApplication(testApp.app, {
        accessToken: bohdan.accessToken,
        input: ROMASHKA,
      });
      const { version } = await uploadResumeVersion(testApp.app, olena);
      const bohdanUpload = await uploadResumeVersion(testApp.app, bohdan);
      await callRoute(testApp.app, {
        method: 'post',
        path: activationPath(version.id),
        accessToken: olena.accessToken,
      });
      const stored = () =>
        Promise.all([
          testApp.prisma.resumeVersion.findUnique({
            where: { id: version.id },
            select: { title: true, note: true, isArchived: true },
          }),
          ...[olena, bohdan].map(({ user }) =>
            testApp.prisma.userSettings.findUnique({
              where: { userId: user.id },
              select: { activeResumeVersionId: true },
            }),
          ),
          ...[olenaApplication, bohdanApplication].map(({ id }) =>
            testApp.prisma.application.findUnique({
              where: { id },
              select: { resumeVersionId: true },
            }),
          ),
        ]);

      const intruder = await callRoute(testApp.app, {
        ...reach({
          olenaVersion: version.id,
          bohdanVersion: bohdanUpload.version.id,
          olenaApplication: olenaApplication.id,
          bohdanApplication: bohdanApplication.id,
        }),
        accessToken: bohdan.accessToken,
      });

      expect(intruder.status).toBe(404);
      expect(errorResponseSchema.parse(intruder.body).type).toBe('not_found');
      expect(await stored()).toEqual([
        { title: 'для продуктових', note: null, isArchived: false },
        { activeResumeVersionId: version.id },
        { activeResumeVersionId: bohdanUpload.version.id },
        { resumeVersionId: null },
        { resumeVersionId: null },
      ]);
      const owner = await callRoute(testApp.app, {
        ...reach({
          olenaVersion: version.id,
          bohdanVersion: version.id,
          olenaApplication: olenaApplication.id,
          bohdanApplication: olenaApplication.id,
        }),
        accessToken: olena.accessToken,
      });
      expect(owner.status).toBe(ownerStatus);
    },
  );
});
