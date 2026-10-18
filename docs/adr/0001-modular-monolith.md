# ADR-0001: Modular monolith plus three satellite services, not microservices

- Status: accepted
- Date: 2026-10-19

## Context

One developer builds the whole system in about eight weeks, it runs only on a laptop, and the architecture still has to hold up at the defense. There is one database and one domain. Analytics needs real statistics libraries, resume files need document tooling, and AI calls need vendor keys kept apart from the main app.

## Decision

The API and the worker are one NestJS codebase with two processes (`src/main.ts` and `src/worker.ts`), split into feature modules that talk only through their public `index.ts` interfaces and domain events. Three Python satellite services run next to it: analytics (read only access to the database), documents and ai (both stateless). There is one database and the API owns it, so the domain is not split into microservices.

## Alternatives

- **Full microservices**: distributed transactions, network failures between services, many deploy units and DevOps work, with no team to justify any of it.
- **Plain monolith in Node only**: simplest to run, but it loses the Python data and AI stack (see [ADR-0002](0002-python-fastapi-analytics.md) and [ADR-0018](0018-ai-as-a-python-service.md)).

## Consequences

- Better: one codebase to debug, one transaction for a write and its event, and clean boundaries that still allow extraction later.
- Worse: a slow module can still slow the whole API, and the satellites add containers to Compose and jobs to CI.
- Watch: module boundaries are checked by lint (imports only through `index.ts`). The extraction path is written down in DOC-08. The document service gets its own record, ADR-0016, which comes with AI-11.

## Links

BE-01, AN-01, AI-01, AI-11. DOC-01, DOC-02, DOC-08. Related: [ADR-0002](0002-python-fastapi-analytics.md), [ADR-0017](0017-nestjs-for-the-api.md), [ADR-0018](0018-ai-as-a-python-service.md).
