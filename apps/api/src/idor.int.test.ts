import { applicationResponseSchema, errorResponseSchema, meResponseSchema } from '@jobflow/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './test/app.js';
import { applicationPath, createApplication, ROMASHKA } from './test/applications.js';
import { BOHDAN, OLENA, signUp } from './test/auth.js';
import { callRoute, type RouteCall } from './test/http.js';
import { TO_SCREENING } from './test/service-fixtures.js';

type OwnerOnlyCase = Omit<RouteCall, 'accessToken'> & { card: string; ownerStatus: number };

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
];

const ROUTES_WITHOUT_IDOR_CASE = [
  { card: 'BE-21', method: 'post', path: '/applications/:id/contacts', resource: 'contact' },
  { card: 'BE-22', method: 'post', path: '/applications/:id/notes', resource: 'note' },
  { card: 'BE-30', method: 'patch', path: '/resumes/versions/:id', resource: 'resume version' },
] as const;

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
      const route = { method, path: `/api/v1${path.replace(':id', application.id)}`, body };

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
      const owner = await callRoute(testApp.app, { ...route, accessToken: olena.accessToken });
      expect(owner.status).toBe(ownerStatus);
    },
  );

  it.each(ROUTES_WITHOUT_IDOR_CASE)(
    "has no $method $path route yet, so $card adds BOHDAN's 404 on OLENA's $resource",
    async ({ method, path }) => {
      const response = await http()[method](`/api/v1${path}`);

      expect(response.status).toBe(404);
      expect(errorResponseSchema.parse(response.body).detail).toBe(
        `Cannot ${method.toUpperCase()} /api/v1${path}`,
      );
    },
  );
});
