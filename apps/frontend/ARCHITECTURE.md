# Frontend Architecture

## Overview

React SPA demonstrating PostgreSQL transaction isolation levels. Two modes:

- **Sandbox** — free-form SQL experimentation
- **Scenarios** — guided step-by-step demos (15 scenarios)

## Component Structure

```
src/
├── components/
│   ├── layout/
│   │   └── header.tsx              # Logo, category dropdowns, connection status
│   │
│   ├── terminal/
│   │   ├── terminal-panel.tsx      # Main container, orchestrates sub-components
│   │   ├── terminal-header.tsx     # Title, status badge, isolation select
│   │   ├── transaction-controls.tsx # BEGIN/COMMIT/ROLLBACK buttons
│   │   ├── sql-editor.tsx          # Monaco editor + run button
│   │   ├── activity-log.tsx        # Recent actions log
│   │   ├── query-result.tsx        # Results table / error display
│   │   ├── sql-presets.tsx         # Quick-access SQL snippets
│   │   └── isolation-select.tsx    # Isolation level dropdown
│   │
│   ├── database-state/
│   │   └── database-state.tsx      # Committed data view + Reset button
│   │
│   ├── explanation/
│   │   ├── explanation-panel.tsx   # Top info bar
│   │   └── quick-start-panel.tsx   # Quick start guide (sandbox mode)
│   │
│   ├── scenario/
│   │   └── scenario-panel.tsx      # Step instructions + Copy/Run buttons
│   │
│   └── ui/                         # Shadcn/ui primitives
│
├── stores/
│   └── session-store.ts            # Terminal sessions state + actions
│
├── hooks/
│   ├── use-socket.ts               # WebSocket connection management
│   ├── use-committed-data.ts       # Committed data + change detection
│   ├── use-database-setup.ts       # Schema initialization
│   └── use-scenario.ts             # Scenario navigation + isolation control
│
├── data/
│   └── scenarios.ts                # 15 scenario definitions
│
├── lib/
│   └── socket-client.ts            # Socket.io instance
│
└── App.tsx                         # Layout orchestration
```

## State Management

Terminal state managed by Zustand store. See [ADR-001](../../docs/adr/001-zustand-over-context-redux.md) for rationale.

```
┌─────────────────────────────────────────────────────────────┐
│                        Zustand Store                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ sessions: { 1: TerminalSession, 2: ..., 3: ... }    │   │
│  │ actions: setSql, execute, executeWithSql,           │   │
│  │          commit, rollback, setIsolationLevel, ...   │   │
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
  executeWithSql: (terminalId, sql) => Promise<void>;
  commit: (terminalId) => Promise<void>;
  rollback: (terminalId) => Promise<void>;
  setIsolationLevel: (terminalId, level) => Promise<void>;
}

interface TerminalSession {
  state: SessionState | null;
  sql: string;
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
       ├── Read sql from sessions[terminalId].sql
       ├── Set isLoading: true
       │
       ▼
WebSocket: session:execute { sessionId, sql }
       │
       ▼
Backend executes, returns result
       │
       ▼
Store updates sessions[terminalId]
       │
       ├── lastResult / lastError
       ├── state (inTransaction, isolationLevel)
       ├── log entry
       └── isLoading: false
```

### Scenario Flow

```
User selects scenario from Header dropdown
       │
       ▼
useScenario.start(scenarioId)
       │
       ├── Set scenario state
       ├── Reset step to 0
       └── Apply isolation levels to all terminals
       │
       ▼
User clicks "Run" on step
       │
       ▼
store.executeWithSql(terminalId, sql)
       │
       ▼
User clicks "Next" or scenario.stop()
       │
       └── Reset isolation levels to READ COMMITTED
```

### Committed Data Updates

```
Any terminal commits (explicit or autocommit)
       │
       ▼
Backend broadcasts: data:committed { table, rows }
       │
       ▼
useCommittedData hook
       │
       ├── Diff against previous data
       ├── Mark changed cells
       └── Clear highlights after 2s
```

## Scenarios

15 scenarios in 4 categories. See [ADR-005](../../docs/adr/005-scenarios-on-frontend.md) for why scenarios live on frontend.

| Category        | Count | Topics                                            |
| --------------- | ----- | ------------------------------------------------- |
| Read Anomalies  | 4     | Dirty read, non-repeatable read, phantom read     |
| Write Anomalies | 4     | Lost update, write skew, FOR UPDATE, SERIALIZABLE |
| Locks           | 4     | Lock wait, FOR SHARE, SKIP LOCKED, NOWAIT         |
| Deadlocks       | 3     | Basic deadlock, chain deadlock, lock queue        |

### Scenario Structure

```typescript
interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  category: 'read-anomalies' | 'write-anomalies' | 'locks' | 'deadlocks';
  terminals: 2 | 3;
  setup: {
    isolationLevels: [IsolationLevel, IsolationLevel, IsolationLevel?];
  };
  steps: ScenarioStep[];
  conclusion: { problem: string; solution: string };
}
```

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Header (scenario dropdowns, connection status)                  │
├───────────────────────────────────┬─────────────────────────────┤
│                                   │                             │
│  ExplanationPanel / ScenarioPanel │      DatabaseState          │
│                                   │      (committed data)       │
├───────────────┬───────────────┬───┴─────────────────────────────┤
│  Terminal 1   │  Terminal 2   │  Terminal 3                     │
│               │               │                                 │
└───────────────┴───────────────┴─────────────────────────────────┘
```

## Hooks

| Hook               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `useSocket`        | WebSocket connection, auto-reconnect       |
| `useCommittedData` | Subscribe to committed data, track changes |
| `useDatabaseSetup` | Initialize schema on first load            |
| `useScenario`      | Scenario state, navigation, isolation sync |

## Related Decisions

- [ADR-001](../../docs/adr/001-zustand-over-context-redux.md) — Why Zustand for state
- [ADR-004](../../docs/adr/004-three-terminals.md) — Why three terminals
- [ADR-005](../../docs/adr/005-scenarios-on-frontend.md) — Why scenarios on frontend
