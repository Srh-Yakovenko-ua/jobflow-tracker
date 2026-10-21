import { errorResponseSchema, meResponseSchema } from '@jobflow/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './test/app.js';
import { BOHDAN, OLENA, signUp } from './test/auth.js';

const ROUTES_WITHOUT_IDOR_CASE = [
  { card: 'BE-14', method: 'get', path: '/applications/:id', resource: 'application' },
  { card: 'BE-17', method: 'post', path: '/applications/:id/events', resource: 'stage event' },
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
