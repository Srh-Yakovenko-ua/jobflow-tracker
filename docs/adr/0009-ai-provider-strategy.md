# ADR-0009: AI behind a Strategy interface with a fake provider and strict data rules

- Status: accepted
- Date: 2026-10-19

## Context

AI parses vacancies, profiles CVs, scores matches and drafts follow ups. Real model calls cost money, are slow and do not repeat exactly. Dev, CI and end to end tests must run for free and deterministically. Users trust the app with private notes and CV files.

## Decision

The Strategy lives inside `services/ai` (Python): an `AiProvider` interface with `AnthropicProvider`, `OpenAiProvider` (NVIDIA through `base_url`) and `FakeAiProvider`, picked by `AI_PROVIDER` (the `.env.example` default is `fake`). Each kind of call has its own structured output schema. Notes and CV files never go to a model: the Node worker allow lists the inputs before the call (AI-04). Node keeps the `ai_results` cache, token accounting and the daily budget (`AI_DAILY_LIMIT`, AI-02).

## Alternatives

- **SDK calls straight from services**: less code at first, but no fake for tests, CI costs money, and the vendor is locked in.
- **An agent framework**: a heavy dependency and a lot of indirection for a few prompts with fixed schemas.

## Consequences

- Better: tests run without keys or network, providers can be swapped by config, and the data rules live in one place in Node.
- Worse: the interface lags new provider features, and the fake can hide prompt problems that only a real model shows.
- Watch: the evaluation set runs against a real provider on demand, and the allow list grows only on purpose.

## Links

AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07. DOC-02. Related: [ADR-0007](0007-no-server-scraping.md), [ADR-0018](0018-ai-as-a-python-service.md).
