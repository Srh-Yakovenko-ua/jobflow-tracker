# ADR-0018: AI as a Python service

- Status: accepted
- Date: 2026-10-19

## Context

AI calls need vendor keys, prompts and a structured output schema per kind. The main app should never hold those keys, and the vendor SDKs and schema tooling are strongest in Python. The thesis also needs a clear story of a part that can scale on its own.

## Decision

`services/ai` is a stateless FastAPI service on port 8001 with `POST /v1/complete/{kind}` and `POST /v1/embed`. Only the worker calls it, with a 60 second RS256 service token (scope `ai:invoke`). Node keeps the queue, the `ai_results` cache, the budget and the allow list. Vendor keys and prompts live only in the service. Its pydantic models come from datamodel-code-generator, fed the JSON Schema that `pnpm gen:contracts` writes through `z.toJSONSchema`.

## Alternatives

- **An AI module inside the Node worker**: no extra service and no network hop, but vendor keys and prompts sit in the main app.
- **An LLM gateway such as a LiteLLM proxy**: routes vendors only, so prompts and structured output stay in Node, and it adds one more container anyway.

## Consequences

- Better: keys and prompts are isolated, the Python AI SDKs are used directly, and the service scales independently of the API.
- Worse: one network hop per call, generated models that must stay in step with the shared schemas, and a service token to mint and verify.
- Watch: the contracts job in CI fails when the generated models drift, and the service stays stateless.

## Links

AI-01, AI-02, AI-04, AI-05, AI-11. DOC-01, DOC-05. Related: [ADR-0009](0009-ai-provider-strategy.md), [ADR-0010](0010-rs256-jwt-refresh-rotation.md).
