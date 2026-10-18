# ADR-0014: GlitchTip instead of hosted Sentry

- Status: accepted
- Date: 2026-10-18

## Context

Errors in the web app, the API, the worker and analytics need one place where they are grouped, counted and tied to a release. The project is local only and spends nothing ([ADR-0008](0008-local-only-no-deployment.md)).

## Decision

Error tracking uses self hosted GlitchTip in the `observability` Compose profile. All services use the standard Sentry SDKs, so switching to hosted Sentry later is a change of DSN. An empty DSN turns error reporting off instead of crashing.

## Alternatives

- **Hosted Sentry free tier**: the best product, but error data leaves the machine, the quota is limited, and it needs an account.
- **Logs only in Loki**: no new service, but no grouping of repeated errors and no release tracking.

## Consequences

- Better: free, offline, and the same code works with Sentry.
- Worse: one more container to run and update, and GlitchTip has fewer features than Sentry.
- Watch: no user text or personal data in error payloads, and the error code shown to the user matches the one in GlitchTip.

## Links

OBS-04, OBS-01, INF-06. DOC-01, DOC-05, DOC-10.
