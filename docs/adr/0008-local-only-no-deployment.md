# ADR-0008: Local only, no deployment

- Status: accepted
- Date: 2026-10-18

## Context

The project is a solo diploma with a $0 budget. It is shown on the developer's laptop at the defense. Cloud accounts, secrets and bills would add work and risk without adding to what is defended.

## Decision

The whole system runs locally with Docker Compose. MinIO replaces S3, Mailpit replaces an SMTP provider, and the observability tools run in their own Compose profile. The only optional cost is AI calls, capped by a daily budget. The deployment path is described in DOC-08 and not built.

## Alternatives

- **Free cloud tiers**: services sleep, quotas run out, secrets have to be managed, and a misconfigured tier can start costing money.
- **A single VPS**: paid, and it brings ops work (TLS, backups, updates) that the thesis does not need.

## Consequences

- Better: zero cost, a demo that works offline, and one `compose.yml` that a reviewer can start.
- Worse: no public URL to share, and production concerns such as TLS and managed backups are only described.
- Watch: adapters (storage, mail) stay behind interfaces, so moving to S3 or a real SMTP provider is an environment change.

## Links

INF-05, INF-07, BE-29, BE-37, OBS-01. DOC-00, DOC-08, DOC-10. Related: [ADR-0014](0014-glitchtip.md).
