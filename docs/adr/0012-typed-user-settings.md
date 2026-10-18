# ADR-0012: User settings as a typed table, not a jsonb blob

- Status: accepted
- Date: 2026-10-18

## Context

Settings drive behaviour across services: silence days and auto ghost days for reminders, time zone and quiet hours for notifications, notification channels, theme, analytics opt out. The worker and analytics read them, not only the settings page.

## Decision

`user_settings` is a one to one table with a typed column per setting, its own constraints and defaults, and changes through migrations. The API reads and writes it through Prisma, analytics reads it through SQLAlchemy, and a change emits `settings.changed`.

## Alternatives

- **A jsonb blob on the user**: flexible, but no types in the database, no constraints, no defaults, and every reader parses and validates it again.
- **A key value table**: easy to add keys, but every value is a string, nothing is typed or constrained, and defaults live in code.

## Consequences

- Better: invalid values are rejected by the database, defaults exist for every new user, and typed access works in Node and Python.
- Worse: a new setting needs a migration and a schema change.
- Watch: the zod schema in `packages/shared` and the table stay in step, and settings that other cards add (active CV version, weekly goal) arrive as columns.

## Links

BE-02, BE-24, BE-04, BE-38, FE-23. DOC-03.
