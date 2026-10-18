# ADR-0007: The server never scrapes job boards

- Status: accepted
- Date: 2026-10-18

## Context

Adding a vacancy has to take seconds, or users stop tracking. Most vacancies live on job boards that forbid automated access, use captchas and change their markup often.

## Decision

The server never fetches job board pages. A vacancy arrives in one of two ways: the bookmarklet runs in the user's own browser, reads the open page and posts its text to the API with a capture token, or the user pastes the text. The API creates a draft and queues AI parsing.

## Alternatives

- **Server side scraping**: terms of service violations, captchas, constant breakage and legal risk, all for a diploma project.
- **Browser extension**: a better experience, but store review and a separate build per browser. It stays a later option on the same capture endpoint (DOC-08).
- **Paid job board APIs**: cost money and cover Ukrainian boards poorly.

## Consequences

- Better: no legal exposure, nothing to break when a board changes its HTML, and the mobile share flow reuses the same endpoint.
- Worse: capture quality depends on AI parsing of raw text, and the bookmarklet needs one install step.
- Watch: parsing quality is measured on an evaluation set with per field confidence, and the capture token is stored hashed, can be revoked and works only for capture. A shared URL without text never makes the server fetch the page.

## Links

BE-26, BE-27, FE-25, FE-26, FE-27, FE-28, AI-03, MOB-03. DOC-01, DOC-08.
