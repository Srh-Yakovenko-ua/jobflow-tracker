Closes <CARD> (<card link>)

## Summary

What changed and why, in two or three sentences.

## How to check

- Command or screen, and what it should show.

## DoD

- [ ] Acceptance criteria of the card met, each one checked by a command or a look
- [ ] Lint, typecheck and tests pass locally and in CI
- [ ] New business logic has unit tests; a new endpoint has an integration test
- [ ] Input validated by a shared zod schema (pydantic in analytics)
- [ ] Errors in the common shape with `requestId`, no stack traces to the client
- [ ] UI: loading, empty and error states; keyboard works; 1440 and 390, light and dark
- [ ] OpenAPI updated if the API changed
- [ ] No secrets in code; new env variables in `.env.example`
- [ ] Card description updated if the implementation differs from the plan

## ADR

- [ ] Чи потрібен ADR для цієї зміни? Якщо так, додано `docs/adr/NNNN-title.md`
