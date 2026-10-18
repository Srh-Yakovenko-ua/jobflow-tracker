# Architecture Decision Records

An ADR is a short, dated note about a decision that is hard to reverse or was seriously debated: the context, the options and why one of them won.

- Write one when a decision changes the architecture, adds infrastructure, or chooses between two serious options. Small library choices do not need one.
- Never edit an accepted ADR. A changed decision gets a new ADR that says "Supersedes ADR-NNNN", and the old one is marked superseded.
- Keep it to one screen and link the cards it affects.

New records start from [the template](0000-template.md) and take the next free number.

| ADR                                         | Title                                                                     | Status   | Date       |
| ------------------------------------------- | ------------------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-modular-monolith.md)            | Modular monolith plus three satellite services, not microservices         | accepted | 2026-10-19 |
| [0002](0002-python-fastapi-analytics.md)    | Python FastAPI for analytics                                              | accepted | 2026-10-18 |
| [0003](0003-append-only-stage-events.md)    | Append only stage events with compensating events for undo                | accepted | 2026-10-18 |
| [0004](0004-transactional-outbox-bullmq.md) | Transactional outbox and BullMQ                                           | accepted | 2026-10-18 |
| [0005](0005-sse-one-time-ticket.md)         | Server Sent Events with a one time ticket instead of WebSockets           | accepted | 2026-10-18 |
| [0006](0006-chartjs-sankey.md)              | Chart.js 4 with chartjs-chart-sankey                                      | accepted | 2026-10-18 |
| [0007](0007-no-server-scraping.md)          | The server never scrapes job boards                                       | accepted | 2026-10-18 |
| [0008](0008-local-only-no-deployment.md)    | Local only, no deployment                                                 | accepted | 2026-10-18 |
| [0009](0009-ai-provider-strategy.md)        | AI behind a Strategy interface with a fake provider and strict data rules | accepted | 2026-10-19 |
| [0010](0010-rs256-jwt-refresh-rotation.md)  | RS256 JWT, refresh rotation with reuse detection, JWKS                    | accepted | 2026-10-19 |
| [0011](0011-api-never-calls-analytics.md)   | The Node API never calls analytics                                        | accepted | 2026-10-18 |
| [0012](0012-typed-user-settings.md)         | User settings as a typed table, not a jsonb blob                          | accepted | 2026-10-18 |
| [0013](0013-feature-sliced-design.md)       | Feature sliced design on the frontend                                     | accepted | 2026-10-18 |
| [0014](0014-glitchtip.md)                   | GlitchTip instead of hosted Sentry                                        | accepted | 2026-10-18 |
| [0015](0015-stack-baseline-2026-10.md)      | Stack baseline, October 2026: newest stable, never release candidates     | accepted | 2026-10-19 |
| [0017](0017-nestjs-for-the-api.md)          | NestJS for the API                                                        | accepted | 2026-10-19 |
| [0018](0018-ai-as-a-python-service.md)      | AI as a Python service                                                    | accepted | 2026-10-19 |
