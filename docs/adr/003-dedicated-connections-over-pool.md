# ADR-003: Dedicated PG Connections Over Connection Pool

## Status

Accepted

## Context

Terminals need PostgreSQL connections. Standard approach is connection pooling, but we have specific requirements for transaction state persistence.

## Options Considered

### 1. Connection pool (pg.Pool)

- Standard pattern
- Pool resets state between requests
- Cannot hold transaction open across multiple requests
- Cannot set different isolation levels per "session"

### 2. Dedicated pg.Client per terminal

- Persistent transaction state
- Different isolation level per session
- Locks preserved between requests
- Limited connections (but we only need 3)

## Decision

Dedicated `pg.Client` for each terminal. Connection lives for the browser session lifetime.

## Consequences

**Positive:**

- Full control over transaction state
- Independent isolation levels per terminal
- Locks persist across queries

**Negative:**

- Does not scale to many users (not required for demo)
