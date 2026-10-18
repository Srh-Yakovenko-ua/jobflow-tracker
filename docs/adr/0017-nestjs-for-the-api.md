# ADR-0017: NestJS for the API

- Status: accepted
- Date: 2026-10-19

## Context

The API has many feature modules that all follow the DOC-02 layers (controller, service, repository) and share cross cutting parts: auth, input validation, the DOC-04 error shape with `requestId`, and logging. One developer writes all of it, so the wiring must look the same in every module and be easy to replace in tests.

## Decision

NestJS 12 on `@nestjs/platform-express` (Express 5) with Prisma 7. Nest modules map onto the DOC-02 controller, service and repository layers, and constructor DI lets tests swap any provider with `overrideProvider`. Guards, pipes (`StandardSchemaValidationPipe` with the shared zod schemas) and exception filters (the DOC-04 error shape) carry the cross cutting parts. It is the developer's choice.

## Alternatives

- **Express 5 with hand written factories**: no decorators and no framework to learn, but every cross cutting part (auth, validation, error mapping) is wired by hand in each module.
- **Fastify with plugins**: fast, with plugin encapsulation, but no module or DI system, so the layers are again a convention. Nest stays on the Express platform.

## Consequences

- Better: every module has the same shape, cross cutting rules live in one place, and tests replace providers without mocking imports.
- Worse: legacy decorators and `emitDecoratorMetadata`, SWC in builds and in Vitest (unplugin-swc 2), and more framework to explain at the defense.
- Watch: typecheck may fall back to `tsc` 6 if tsgo cannot check the decorators (BE-01 decides), and modules still import each other only through `index.ts`.

## Links

BE-01. DOC-02, DOC-04, DOC-05. Related: [ADR-0001](0001-modular-monolith.md), [ADR-0015](0015-stack-baseline-2026-10.md).
