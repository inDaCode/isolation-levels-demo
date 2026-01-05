# ADR-005: Scenarios Stored on Frontend

## Status

Accepted

## Context

15 guided scenarios with steps, explanations, and SQL examples. Need to decide where to store them.

## Options Considered

### 1. Backend stores scenarios

- Scenarios are UI/educational content, not business logic
- Requires API endpoints for loading
- Changing a scenario requires backend deploy

### 2. Frontend stores scenarios

- Scenarios belong to presentation layer
- Backend remains stateless SQL executor
- Add scenarios without backend changes
- Enables offline browsing (future)

## Decision

Scenarios defined in `frontend/src/data/scenarios.ts`. Backend only executes SQL — it has no knowledge of "steps" or "explanations".

## Consequences

**Positive:**

- Clear separation of concerns
- Fast iteration on content
- No backend deploy for scenario changes

**Negative:**

- If sharing scenarios between multiple frontends needed — would require extraction to shared package
