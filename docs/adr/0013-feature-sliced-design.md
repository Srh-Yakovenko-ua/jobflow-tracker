# ADR-0013: Feature sliced design on the frontend

- Status: accepted
- Date: 2026-10-18

## Context

The web app grows to a dozen screens: board, vacancy card, add flow, analytics, resumes, calendar, reminders, settings. One developer has to keep it navigable, and the thesis needs a frontend structure that can be explained and checked.

## Decision

`apps/web/src` follows feature sliced design with the layers `app`, `widgets`, `features`, `entities` and `shared`. A layer imports only from the layers below it, and `eslint-plugin-boundaries` enforces the rule in lint.

## Alternatives

- **Folders by file type** (`components`, `hooks`, `utils`): familiar, but it does not scale, and one feature ends up spread across the tree.
- **Feature folders without layers**: closer to the domain, but there is no import rule, so features import each other and cycles appear.

## Consequences

- Better: a clear place for every file, a lint error on a wrong import, slices that can be tested alone.
- Worse: more folders and public `index.ts` files, and deciding between a feature and a widget takes a moment.
- Watch: `shared` stays free of domain code, and no slice reaches into another slice's internals.

## Links

FE-01, FE-03, FE-04, FE-05, FE-11, INF-02. DOC-06.
