Closes <CARD> (<card link>)

## Summary

What changed and why, in two or three sentences.

## How to check

- Command or screen, and what it should show.

## Screenshots

| Width | Light | Dark |
| ----- | ----- | ---- |
| 1440  |       |      |
| 390   |       |      |

Write "No UI change" instead of the table when nothing on screen changed.

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

## Design QA (section 22)

UI pull requests only; tick what was checked, write n/a otherwise.

- [ ] Tokens only, no raw colour (hex only through `chart-theme`, enforced by lint)
- [ ] Lucide icons only, `strokeWidth` 1.9, sizes 16 / 20 / 24
- [ ] Every hover has a pressed pair
- [ ] Focus visible everywhere: ring 2+2, never `outline: none`
- [ ] Touch target at least 44 px
- [ ] Text contrast at least 4.5:1, `ink-3` is the floor
- [ ] State never by colour alone: colour, marker shape and label
- [ ] Percent only from a sample of 5, otherwise "мало даних"
- [ ] Rejection is never red (clay)
- [ ] Ghosted is excluded from conversions
- [ ] Every AI operation shows queued, processing, done and error
- [ ] `prefers-reduced-motion` turns off all motion, chart replays included
- [ ] `tabular-nums` on every number

## ADR

- [ ] Чи потрібен ADR для цієї зміни? Якщо так, додано `docs/adr/NNNN-title.md`
