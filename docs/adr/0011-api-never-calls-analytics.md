# ADR-0011: The Node API never calls analytics

- Status: accepted
- Date: 2026-10-18

## Context

Two services can easily grow into a chain where one waits on the other. If the API waited on analytics inside a request, a slow pandas query or a stopped analytics container would break writes that have nothing to do with charts.

## Decision

The API never makes an HTTP call to analytics. The browser calls analytics directly for dashboards with the user's own access token. The worker calls analytics for background jobs, such as the monthly summary and the weekly goal, with a service token: an RS256 JWT signed with the same key, `sub` set to the user id, scope `analytics:read`, valid for 60 seconds.

## Alternatives

- **The API proxies analytics**: one origin for the browser, but synchronous coupling, and a failure in analytics cascades into the API.
- **Analytics logic inside the API**: no second service, but it loses the Python stack (see [ADR-0002](0002-python-fastapi-analytics.md)).

## Consequences

- Better: the API keeps working when analytics is down, and each service fails and scales on its own.
- Worse: the browser talks to two origins, so CORS and token handling are set up twice.
- Watch: service tokens stay short lived and read only, and analytics scopes every query by the token's user id.

## Links

AN-01, AN-03, AN-16, AI-08, BE-38, FE-33. DOC-01, DOC-10. Related: [ADR-0010](0010-rs256-jwt-refresh-rotation.md).
