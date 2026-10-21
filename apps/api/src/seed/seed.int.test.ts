import {
  authResponseSchema,
  DEFAULT_SEARCH_TITLE,
  registerInputSchema,
  REJECTION_REASONS,
} from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthModule } from '../modules/auth/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { appTestingModule, startTestApp } from '../test/app.js';
import { resetDatabase } from '../test/database.js';
import { SeedRepository } from './seed.repository.js';
import { DEMO_USER, SeedService } from './seed.service.js';

const REASON_SELECT = { code: true, side: true, labelUk: true, labelEn: true, sortOrder: true };

describe('the seed', () => {
  let app: NestExpressApplication;

  const prisma = () => app.get(PrismaService);
  const seed = () => app.get(SeedService);

  beforeAll(async () => {
    app = await startTestApp(
      appTestingModule({ imports: [AuthModule], providers: [SeedRepository, SeedService] }),
    );
  });

  beforeEach(() => resetDatabase(prisma()));

  afterAll(() => app.close());

  it('run twice restores the shared reason labels and keeps one demo user with settings and one active search', async () => {
    await seed().run();
    await prisma().rejectionReason.update({
      where: { code: 'skills_gap' },
      data: { labelUk: 'змінена мітка' },
    });
    await seed().run();

    const reasons = await prisma().rejectionReason.findMany({ select: REASON_SELECT });
    const reasonsByCode = Object.fromEntries(reasons.map(({ code, ...reason }) => [code, reason]));
    expect(reasonsByCode).toEqual(REJECTION_REASONS);
    const users = await prisma().user.findMany({
      where: { email: 'demo@jobflow.local' },
      include: { settings: true, searches: { where: { status: 'active' } } },
    });
    expect(users).toHaveLength(1);
    const [demo] = users;
    expect(demo?.settings?.silenceDays).toBe(7);
    expect(demo?.searches.map((search) => search.title)).toEqual([DEFAULT_SEARCH_TITLE]);
  });

  it('lets the demo user sign in', async () => {
    await seed().run();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: DEMO_USER.email, password: DEMO_USER.password });

    expect(response.status).toBe(200);
    expect(authResponseSchema.parse(response.body).user.email).toBe('demo@jobflow.local');
  });

  it('keeps the demo credentials within the register rules', () => {
    expect(registerInputSchema.parse(DEMO_USER)).toEqual(DEMO_USER);
  });
});
