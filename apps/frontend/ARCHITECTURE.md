# Frontend Architecture

## Overview

React SPA demonstrating PostgreSQL transaction isolation levels. Two modes:

- **Sandbox** — free-form SQL experimentation
- **Scenarios** — guided step-by-step demos of isolation phenomena

## Design Decisions

### Why Zustand over Context/Redux?

**Problem:** ScenarioPanel needs to execute SQL in any terminal. Initially used `forwardRef` + `useImperativeHandle`, but this created timing issues between `setSql()` and `execute()` calls.

**Options considered:**

1. **Keep refs, fix timing** — adds complexity, imperative API is a code smell for this use case
2. **Lift state to App + Context** — works, but callbacks recreate on every state change (stale closures)
3. **Redux** — overkill for 3 terminals, too much boilerplate
4. **Zustand** — minimal API, stable action references, granular subscriptions

**Decision:** Zustand. Clean separation between state and UI, no prop drilling, each terminal subscribes only to its own data.

### Why 3 Terminals?

Most isolation demos use 2 sessions. We use 3 because:

- Chain deadlock requires 3 participants (A waits for B, B waits for C, C waits for A)
- Lock queue visualization needs a "waiting" transaction while two others hold/request locks
- Demonstrates real-world complexity

### Why SQL in Store (not local state)?

ScenarioPanel needs to both set SQL and execute it in a terminal. With local state:

```typescript
// Race condition: state update is async
terminalRef.setSql(sql);
terminalRef.execute(); // executes OLD sql
```

With store:

```typescript
setSql(terminalId, sql); // immediate
execute(terminalId); // reads from store
```

Single source of truth, no timing issues.

### Why Scenarios on Frontend (not Backend)?

Scenarios are UI/educational content, not business logic. Backend only needs to execute SQL — it doesn't need to know about "steps" or "explanations".

This also allows:

- Adding scenarios without backend changes
- Different scenario sets for different audiences (future)
- Offline scenario browsing (future)

## Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   └── header.tsx              # Logo, scenario select, connection status
│   │
│   ├── terminal/
│   │   ├── terminal-panel.tsx      # Monaco editor + controls + activity log
│   │   ├── query-result.tsx        # Results table / error display
│   │   ├── sql-presets.tsx         # Quick-access SQL snippets
│   │   └── isolation-select.tsx    # Isolation level dropdown
│   │
│   ├── database-state/
│   │   └── database-state.tsx      # Committed data view + Reset
│   │
│   ├── explanation/
│   │   └── explanation-panel.tsx   # Sandbox mode welcome
│   │
│   ├── scenario/
│   │   ├── scenario-select.tsx     # Scenario picker dropdown
│   │   └── scenario-panel.tsx      # Step instructions + Copy/Run
│   │
│   └── ui/                         # Shadcn/ui primitives
│
├── stores/
│   └── session-store.ts            # Terminal sessions state + actions
│
├── hooks/
│   ├── use-socket.ts               # Connection management
│   ├── use-committed-data.ts       # Committed data + change detection
│   ├── use-database-setup.ts       # Schema initialization
│   └── use-scenario.ts             # Scenario navigation
│
├── data/
│   └── scenarios.ts                # Scenario definitions
│
├── lib/
│   └── socket-client.ts            # Socket.io instance
│
└── App.tsx                         # Layout orchestration
```

## State Management

```
┌─────────────────────────────────────────────────────────────┐
│                        Zustand Store                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ sessions: { 1: TerminalSession, 2: ..., 3: ... }    │   │
│  │ actions: setSql, execute, commit, rollback, ...     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
        │                    │                    │
   TerminalPanel(1)    TerminalPanel(2)    ScenarioPanel
   subscribes to       subscribes to       calls actions
   sessions[1]         sessions[2]         for any terminal
```

### Store Structure

```typescript
interface SessionStore {
  sessions: Record<TerminalId, TerminalSession>;

  setSql: (terminalId, sql) => void;
  createSession: (terminalId, isolationLevel?) => Promise<void>;
  execute: (terminalId) => Promise<void>;
  commit: (terminalId) => Promise<void>;
  rollback: (terminalId) => Promise<void>;
  setIsolationLevel: (terminalId, level) => Promise<void>;
}

interface TerminalSession {
  state: SessionState | null; // from backend
  sql: string; // editor content
  lastResult: QueryResult | null;
  lastError: QueryError | null;
  lastWasTransactionCommand: boolean;
  log: LogEntry[];
  isLoading: boolean;
}
```

## Data Flow

### Query Execution

```
User clicks Run
       │
       ▼
store.execute(terminalId)
       │
       ├── get sql from sessions[terminalId].sql
       ├── set isLoading: true
       │
       ▼
WebSocket: session:execute { sessionId, sql }
       │
       ▼
Backend executes, returns result
       │
       ▼
store updates sessions[terminalId]
       │
       ├── lastResult / lastError
       ├── state (inTransaction, isolationLevel)
       ├── log entry
       └── isLoading: false
```

### Scenario Execution

```
User clicks "Run" in ScenarioPanel
       │
       ▼
store.setSql(step.terminal, step.sql)
       │
       ▼
store.execute(step.terminal)
       │
       ▼
TerminalPanel re-renders with new sql + result
```

### Committed Data Broadcast

```
Any terminal commits (explicit or autocommit)
       │
       ▼
Backend broadcasts: data:committed { table, rows }
       │
       ▼
useCommittedData hook receives
       │
       ├── diff against previous data
       ├── mark changed cells
       └── clear highlights after 2s
```

## Error Handling Strategy

| Error Type        | Handling                                                |
| ----------------- | ------------------------------------------------------- |
| Socket disconnect | Show "Connecting...", disable all controls              |
| Query error       | Display in Results panel, add to log, session continues |
| Transaction error | Backend auto-rollbacks, state resets to idle            |
| Network timeout   | Caught in store, logged as "Execution failed"           |

## Styling Conventions

- **Tailwind CSS** + **Shadcn/ui** for consistency
- **Dark theme** (zinc-900 base) — easier on eyes for code-heavy UI
- **Color semantics:**
  - Green: success, committed, active transaction
  - Yellow: warning, in-transaction state, changed cells
  - Red: errors
  - Blue: informational (scenario panel)
  - Gray: idle, secondary info

## Performance Considerations

- **Granular subscriptions:** Each TerminalPanel subscribes only to `sessions[terminalId]`, not entire store
- **Stable action references:** Zustand actions don't change between renders
- **Monaco Editor:** `automaticLayout: true` handles resize, single instance per terminal
- **Log trimming:** Max 10 entries per terminal, display last 3

## Testing Strategy (Planned)

| Layer      | Tool                  | Focus                           |
| ---------- | --------------------- | ------------------------------- |
| Store      | Vitest                | Action logic, state transitions |
| Components | React Testing Library | User interactions               |
| E2E        | Playwright            | Full scenarios                  |

Priority: Store tests first (most logic), E2E for critical paths, component tests where useful.
