# ADR-0004: Transactional outbox and BullMQ

- Status: accepted
- Date: 2026-10-18

## Context

Writes trigger side effects: AI parsing, match score updates, reminders, notifications, cache invalidation, live updates. A side effect must not be lost when Redis is down or the process crashes between the database commit and the publish.

## Decision

A write that emits a domain event inserts an `outbox` row in the same transaction as the data. Request handlers never publish to the queue directly. An outbox relay in the worker picks unpublished rows with `SELECT ... FOR UPDATE SKIP LOCKED`, publishes them to BullMQ and marks them published.

## Alternatives

- **Publish after commit**: no extra table, but an event is lost if the process dies between the commit and the publish, and a failed publish cannot be retried.
- **Kafka**: durable streams and replay, but heavy to run on one laptop and far more than a few queues need.

## Consequences

- Better: data and event commit together, and a Redis outage only delays side effects.
- Worse: delivery is at least once, so every consumer must be idempotent, and there is a small delay between the write and the effect.
- Watch: the backlog of rows where `published_at` is null. Moving to Kafka or NATS later changes only the relay target (DOC-08).

## Links

BE-04, BE-11, BE-20, BE-31, BE-32. DOC-01, DOC-02, DOC-03, DOC-08.
