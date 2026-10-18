# ADR-0010: RS256 JWT, refresh rotation with reuse detection, JWKS

- Status: accepted
- Date: 2026-10-19

## Context

Three services verify the same tokens: the NestJS API, the Python analytics service and the Python ai service. Neither Python service may have its own user database or be able to issue tokens. A stolen refresh token is the main session risk in a browser app.

## Decision

The API signs short lived access tokens with RS256 and publishes the public key as JWKS. Analytics and the ai service verify tokens with that public key, so there is no shared secret and no user database in Python. The worker mints 60 second service tokens with the `analytics:read` and `ai:invoke` scopes. Refresh tokens are stored as hashes with a `family_id` and rotate on every use. A reused refresh token revokes the whole family.

## Alternatives

- **HS256 with a shared secret**: simpler, but every service that verifies could also mint tokens.
- **Server sessions in Redis**: easy revocation, but both Python services would need session lookups and the API would stop being stateless.

## Consequences

- Better: no shared secret, a stateless API that scales horizontally, and refresh theft gets detected.
- Worse: a key pair to generate and keep out of git, and access tokens stay valid until they expire.
- Watch: key loading fails fast at boot, access and service token lifetimes stay short, each service checks the scope it needs, and key rotation keeps the old key in JWKS for a while.

## Links

INF-06, BE-07, BE-08, AN-03, AI-01, FE-03, FE-10, SEC-01. DOC-01, DOC-04. Related: [ADR-0011](0011-api-never-calls-analytics.md), [ADR-0018](0018-ai-as-a-python-service.md).
