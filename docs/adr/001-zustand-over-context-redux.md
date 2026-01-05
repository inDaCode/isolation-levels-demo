# ADR-001: Zustand for Terminal State Management

## Status

Accepted

## Context

ScenarioPanel needs to set SQL and execute queries in any of the three terminals. Initially used `forwardRef` + `useImperativeHandle`, but this created timing issues — state updates were async, so `execute()` would run before `setSql()` completed.

## Options Considered

### 1. Keep refs, fix timing

Add callback or await for state updates.

- Adds complexity
- Imperative API is a code smell for this use case

### 2. Lift state to App + Context

Move terminal state to App, pass through Context.

- Works
- Callbacks recreate on every state change (stale closures)
- All terminals re-render on any change

### 3. Redux

- Stable dispatch references
- Overkill for 3 terminals
- Too much boilerplate (actions, reducers, selectors)

### 4. Zustand

- Minimal API
- Stable action references
- Granular subscriptions — terminal subscribes only to its own data
- No boilerplate

## Decision

Use Zustand. Each terminal subscribes to `sessions[terminalId]`, ScenarioPanel calls actions directly.

## Consequences

**Positive:**

- Clean state/UI separation
- No prop drilling
- No timing issues

**Negative:**

- Additional dependency (3KB gzipped)
