import { authResponseSchema, DEFAULT_SEARCH_TITLE, errorResponseSchema } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { appTestingModule, startTestApp } from '../../test/app.js';
import { resetDatabase } from '../../test/database.js';
import { memoryLog, withLogSink } from '../../test/memory-log.js';

const MARKER_PASSWORD = 'marker-pass-6f1c2a';

const OLENA = { email: 'olena@example.test', password: MARKER_PASSWORD, displayName: 'Олена' };

const log = memoryLog();

describe('register and login with email and password', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const register = (body: object) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(body);

  const login = (body: object) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send(body);

  beforeAll(async () => {
    app = await startTestApp(withLogSink(appTestingModule(), log.sink));
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user with default settings and exactly one active search', async () => {
    const response = await register(OLENA);

    expect(response.status).toBe(201);
    const { user } = authResponseSchema.parse(response.body);
    expect(user).toMatchObject({ email: OLENA.email, displayName: 'Олена', locale: 'uk' });
    expect(response.body).toEqual({ user });
    const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
    expect(settings?.silenceDays).toBe(7);
    const searches = await prisma.search.findMany({ where: { userId: user.id, status: 'active' } });
    expect(searches.map((search) => search.title)).toEqual([DEFAULT_SEARCH_TITLE]);
    expect(DEFAULT_SEARCH_TITLE).toBe('Мій пошук');
  });

  it('refuses an email that is already registered, in any case, with 409', async () => {
    await register(OLENA);

    const response = await register({ ...OLENA, email: 'OLENA@Example.TEST' });

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'conflict',
      detail: 'Email is already registered',
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it('refuses a password shorter than 10 characters with 422 on the password path', async () => {
    const response = await register({ ...OLENA, password: 'short-pw' });

    expect(response.status).toBe(422);
    const body = errorResponseSchema.parse(response.body);
    expect(body.errors?.map((error) => error.path)).toEqual(['password']);
    expect(JSON.stringify(body)).not.toContain('short-pw');
    expect(await prisma.user.count()).toBe(0);
  });

  it('signs a registered user in with 200 and the same user', async () => {
    const registered = authResponseSchema.parse((await register(OLENA)).body);

    const response = await login({ email: OLENA.email, password: OLENA.password });

    expect(response.status).toBe(200);
    expect(authResponseSchema.parse(response.body)).toEqual(registered);
  });

  it('answers a wrong password and an unknown email with the same generic 401', async () => {
    await register(OLENA);

    const wrongPassword = await login({ email: OLENA.email, password: 'not-the-password' });
    const unknownEmail = await login({ email: 'nobody@example.test', password: MARKER_PASSWORD });

    const generic = { status: 401, type: 'unauthorized', detail: 'Invalid email or password' };
    const outcomes = [wrongPassword, unknownEmail].map((response) => {
      const { status, type, detail } = errorResponseSchema.parse(response.body);
      return { httpStatus: response.status, status, type, detail };
    });
    expect(outcomes).toEqual([
      { httpStatus: 401, ...generic },
      { httpStatus: 401, ...generic },
    ]);
  });

  it('writes the password to no log line on register, login, 422 or 401', async () => {
    log.lines.length = 0;

    await register(OLENA);
    await login({ email: OLENA.email, password: MARKER_PASSWORD });
    await register({ email: 'not-an-email', password: MARKER_PASSWORD });
    await login({ email: 'nobody@example.test', password: MARKER_PASSWORD });

    expect(log.lines.length).toBeGreaterThan(0);
    const written = log.lines.join('\n');
    expect(written).not.toContain(MARKER_PASSWORD);
    expect(written).not.toContain('nobody@example.test');
  });
});
