# ADR-0015: Stack baseline, October 2026: newest stable, never release candidates

- Status: accepted
- Date: 2026-10-19

## Context

The project starts in October 2026 and is defended about eight weeks later. The versions must be current enough to defend, stable enough to not cost days of debugging, and fixed so that a build can be reproduced.

## Decision

Use the newest stable major of every tool, never a release candidate:

- Node.js 26 LTS (`.nvmrc`), pnpm 12 (`pnpm@12.14.0`), Turborepo 2, Prettier 3.
- TypeScript 6 (`~6.0.3`) for build and lint, plus the native TypeScript 7 checker (`typescript@^7.0.2`, run through `packages/config/bin/tsgo.js`) for typecheck, because typescript-eslint does not support 7 yet. `apps/api` falls back to `tsc` 6 if tsgo cannot check the legacy decorators cleanly; BE-01 decides.
- ESLint 10 (`^10.13.0`), zod 4 (`^4.6.7`), Vitest 4 (`^4.1.12`) instead of Jest, with unplugin-swc 2 for decorator metadata in the API.
- NestJS 12.1 for the API: `@nestjs/core` 12.1.3, `@nestjs/cli` 12.0.8 with the SWC builder, `@nestjs/bullmq` 12.0, nestjs-pino 5.3, ESM only. No passport, `@nestjs/jwt`, class-validator or class-transformer.
- Prisma 7.10 (`@prisma/client` 7.10.1) with the Rust free `prisma-client` generator and `@prisma/adapter-pg`. Prisma 8 is a release candidate with a different query API, so the move waits for its GA; Prisma 7 gets fixes for 18 months after that.
- PostgreSQL 18 with native `uuidv7()` (image `postgres:18.6-alpine`), Redis 8 (image `redis:8.10.2-alpine`).
- Next.js 16 with Turbopack and the React Compiler, React 19, Tailwind CSS 4, FullCalendar 7.
- Python 3.14, pandas 3. AI service: FastAPI 0.146, pydantic 2.14, openai 3.35, anthropic 1.15, datamodel-code-generator 0.86.
- Grafana Alloy instead of Promtail (end of life since March 2026), Jaeger v2, Expo SDK 57.

Majors change only between stages, never inside a card. Each major upgrade gets a new ADR that supersedes this one.

## Alternatives

- **The previous LTS line** (Node 24, PostgreSQL 17): a longer track record, but PostgreSQL 17 has no native `uuidv7()`, and both are already the older line on the day the project starts.
- **Release candidates or floating latest** (Prisma 8, PostgreSQL 19, Python 3.15 out for only days): newest features, but query APIs still move, scientific wheels lag and builds cannot be reproduced.

## Consequences

- Better: current tools, one known set of versions for the thesis, and pinned images in Compose and CI.
- Worse: early majors have fewer answers online, and two TypeScript versions run side by side.
- Watch: typescript-eslint support for TypeScript 7, after which the extra checker can go, and the Prisma 8 GA.

## Links

INF-01, INF-02, INF-04, INF-05, INF-08, BE-01, AI-01, OBS-01, OBS-03, MOB-01. DOC-01, DOC-05. Related: [ADR-0017](0017-nestjs-for-the-api.md), [ADR-0018](0018-ai-as-a-python-service.md).
