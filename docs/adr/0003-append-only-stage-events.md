# ADR-0003: Append only stage events with compensating events for undo

- Status: accepted
- Date: 2026-10-18

## Context

The history of an application is the product. Funnels, time in stage, ghost rates and the timeline all need every stage transition with the time it happened. Users also make mistakes on the board and need undo.

## Decision

Every transition inserts a row into `stage_events`, which is append only. `applications.current_stage` changes only in the same transaction that inserts the event, after the shared stage machine (`canTransition`) allows it. Undo never deletes or updates an event: it writes a compensating event linked by `compensates_event_id`, and analytics drops undone pairs.

## Alternatives

- **Mutable status column**: simple, but the history is lost and no time based metric can be computed.
- **Full event sourcing**: state rebuilt from events everywhere, projections and replays. Too heavy for one developer when only stages need a history.

## Consequences

- Better: analytics and the timeline read one honest log, and every undo is visible and explainable.
- Worse: every consumer has to handle compensating pairs, and the event table only grows.
- Watch: no code path updates `current_stage` outside the transition service, and no migration touches existing events.

## Links

INF-04, BE-03, BE-17, BE-18, BE-34, AN-04, FE-12. DOC-03.
