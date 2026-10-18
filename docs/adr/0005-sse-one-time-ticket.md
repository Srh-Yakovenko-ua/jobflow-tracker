# ADR-0005: Server Sent Events with a one time ticket instead of WebSockets

- Status: accepted
- Date: 2026-10-18

## Context

The browser needs live updates: AI job states, notifications and board changes. Updates flow only from the server to the browser. The API authenticates with a bearer access token in a header.

## Decision

One SSE connection per tab on `/events/stream` updates the TanStack Query cache. `EventSource` cannot send headers, so the client first calls `POST /events/ticket` with its access token and gets a one time ticket valid for 30 seconds, then opens the stream with that ticket. The worker publishes updates to Redis pub/sub and the API forwards them to the open connections.

## Alternatives

- **WebSockets**: two way traffic is not needed, and they need their own auth handshake and reconnect logic.
- **Polling with `refetchInterval`**: no new transport, but updates arrive late and every open tab keeps loading the API. It stays only as the fallback when SSE fails.
- **Access token in the stream URL**: rejected, because URLs end up in logs and browser history and the token would leak.

## Consequences

- Better: plain HTTP, built in reconnect, no extra library on either side.
- Worse: one more endpoint, and a reconnect needs a fresh ticket because the old one is spent.
- Watch: a used or expired ticket gets 401, and the stream sends only the current user's events.

## Links

BE-28, FE-28, FE-39, FE-04. DOC-04, DOC-06.
