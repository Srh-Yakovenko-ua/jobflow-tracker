# ADR-0002: Python FastAPI for analytics

- Status: accepted
- Date: 2026-10-18

## Context

The dashboard needs funnels, stage conversions, a Sankey flow, time in stage, A/B comparison of CV versions and an offer forecast with Monte Carlo simulation. This is statistics code that has to be short, testable and easy to explain in the thesis.

## Decision

Analytics is a FastAPI service in Python with pandas, numpy and scipy. It reads Postgres through a read only database role and never writes domain data, which gives a light form of CQRS: the Node API owns writes, analytics owns heavy reads.

## Alternatives

- **Everything in Node**: one language, but the statistics libraries are weak and forecasts would be hand written math.
- **R with Plumber**: strong statistics, but a third language, a third runtime in Compose and CI, and a smaller pool of web tooling.
- **SQL views only**: no extra service, but forecasts, simulations and A/B tests are awkward and hard to unit test in SQL.

## Consequences

- Better: metric code stays close to the formulas, tests run on plain data frames, and the read only role makes accidental writes impossible.
- Worse: a second language in CI (uv, ruff, mypy, pytest) and enums that must be shared across languages.
- Watch: Python reads the generated `enums.json` from `packages/shared` and never declares its own stage or source lists.

## Links

AN-01, AN-02, AN-05, AN-13, AN-17, INF-08. DOC-01, DOC-05. Related: [ADR-0001](0001-modular-monolith.md), [ADR-0011](0011-api-never-calls-analytics.md).
