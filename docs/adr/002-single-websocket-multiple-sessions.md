# ADR-002: Single WebSocket, Multiple PostgreSQL Sessions

## Status

Accepted

## Context

Each terminal requires its own PostgreSQL connection to demonstrate isolation between transactions. Need to decide how to organize WebSocket connections.

## Options Considered

### 1. WebSocket per terminal

Each terminal opens its own WebSocket connection.

- Complex connection management on client
- Harder to broadcast committed data to all terminals
- More overhead for reconnect logic

### 2. Single WebSocket, server-managed sessions

One WebSocket, each request contains `sessionId` to route to the correct PG connection.

- Simple client code
- Easy to broadcast updates to all terminals
- Server controls session lifecycle

## Decision

Single WebSocket. Backend creates a dedicated `pg.Client` for each terminal, maps via `sessionId`.

## Consequences

**Positive:**

- Simpler client implementation
- Centralized session management
- Easy broadcast to all terminals

**Negative:**

- Backend must track sessionId to PG connection mapping
