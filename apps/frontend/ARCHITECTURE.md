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
│   │   └── header.tsx                # Logo, category dropdowns, connection status
│   │
│   ├── terminal/
│   │   ├── index.tsx                 # Main container (TerminalPanel)
│   │   ├── terminal-header.tsx       # Title (colored), status, isolation select
│   │   ├── transaction-controls.tsx  # BEGIN/COMMIT/ROLLBACK buttons
│   │   ├── sql-editor.tsx            # Monaco editor + run button
│   │   ├── activity-log.tsx          # Recent actions log
│   │   ├── query-result.tsx          # Results table / error display
│   │   ├── sql-presets.tsx           # Quick-access SQL snippets
│   │   └── isolation-select.tsx      # Isolation level dropdown
│   │
│   ├── database-state/
│   │   ├── index.tsx                 # Main container (DatabaseState)
│   │   ├── table-view.tsx            # Table with committed + pending data
│   │   └── pending-changes.ts        # Diff computation logic
│   │
│   ├── explanation/
│   │   ├── explanation-panel.tsx     # Top info bar
│   │   └── quick-start-panel.tsx     # Quick start guide (sandbox mode)
│   │
│   ├── scenario/
│   │   └── scenario-panel.tsx        # Step instructions + Copy/Run buttons
│   │
│   └── ui/                           # Shadcn/ui primitives
│
├── stores/
│   └── session-store.ts              # Terminal sessions + uncommitted data
│
├── hooks/
│   ├── use-socket.ts                 # WebSocket connection management
│   ├── use-committed-data.ts         # Committed data + change detection
│   ├── use-database-setup.ts         # Schema initialization
│   └── use-scenario.ts               # Scenario navigation + isolation control
│
├── data/
│   └── scenarios.ts                  # 15 scenario definitions
│
├── lib/
│   ├── socket-client.ts              # Typed Socket.io instance
│   ├── constants.ts                  # Terminal colors
│   └── utils.ts                      # Tailwind cn() helper
│
└── App.tsx                           # Layout orchestration
```

## State Management

Terminal state and uncommitted data managed by Zustand store.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Zustand Store                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ sessions: { 1: TerminalSession, 2: ..., 3: ... }        │   │
│  │ uncommitted: { 1: UncommittedSnapshot | null, 2: ..., 3: ... } │
│  │ actions: execute, commit, rollback, clearUncommitted    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Store Structure

```typescript
interface SessionStore {
  sessions: Record<TerminalId, TerminalSession>;
  uncommitted: Record<TerminalId, UncommittedSnapshot | null>;

  setSql: (terminalId, sql) => void;
  createSession: (terminalId, isolationLevel?) => Promise<void>;
  execute: (terminalId) => Promise<void>;
  executeWithSql: (terminalId, sql) => Promise<void>;
  commit: (terminalId) => Promise<void>;
  rollback: (terminalId) => Promise<void>;
  setIsolationLevel: (terminalId, level) => Promise<void>;
  clearUncommitted: (terminalId) => void;
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

interface UncommittedSnapshot {
  terminalId: TerminalId;
  tables: {
    accounts: Record<string, unknown>[];
    products: Record<string, unknown>[];
  };
  modifiedRows: {
    accounts: string[];
    products: string[];
  };
}
```

## Uncommitted Data Flow

```
Terminal executes query in transaction
       │
       ▼
Backend tracks modified rows (before/after snapshot comparison)
       │
       ▼
Backend returns { result, uncommitted: { terminalId, tables, modifiedRows } }
       │
       ▼
Store: uncommitted[terminalId] = snapshot
       │
       ▼
DatabaseState subscribes to uncommitted
       │
       ▼
computePendingChanges() filters by modifiedRows:
  - Only shows changes for rows in modifiedRows
  - Ignores rows terminal sees but didn't modify
       │
       ▼
TableView renders:
  - Updates: "1000 → 500 (T1)" in blue
  - Inserts: new row with blue background
  - Deletes: "1000 → ∅ (T1)" strikethrough
```

## Pending Changes Logic

The `computePendingChanges()` function computes what to display:

```typescript
// For each terminal with uncommitted data:
for (const terminalId of [1, 2, 3]) {
  const { tables, modifiedRows } = uncommitted[terminalId];

  // Only process rows that this terminal actually modified
  for (const row of tables[tableName]) {
    if (!modifiedRows[tableName].includes(rowId)) {
      continue; // Skip — terminal sees this but didn't change it
    }

    // Compare with committed data and record the change
  }
}
```

This prevents false positives when:

- T1 starts transaction, sees `balance = 1000`
- T2 updates to `balance = 1500`, commits
- T1 still sees `balance = 1000` (isolation) but didn't modify it
- Without `modifiedRows` check, UI would incorrectly show T1 will change it back

## Terminal Colors

Consistent across the app (defined in `lib/constants.ts`):

- **Terminal 1**: Blue (`text-blue-400`, `bg-blue-900/30`)
- **Terminal 2**: Green (`text-green-400`, `bg-green-900/30`)
- **Terminal 3**: Orange (`text-orange-400`, `bg-orange-900/30`)

## Scenarios

15 scenarios in 4 categories. See [ADR-005](../../docs/adr/005-scenarios-on-frontend.md).

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
│                                   │   (committed + uncommitted) │
├───────────────┬───────────────┬───┴─────────────────────────────┤
│  Terminal 1   │  Terminal 2   │  Terminal 3                     │
│  (blue)       │  (green)      │  (orange)                       │
└───────────────┴───────────────┴─────────────────────────────────┘
```

## Hooks

| Hook               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `useSocket`        | Typed WebSocket connection, auto-reconnect |
| `useCommittedData` | Subscribe to committed data, track changes |
| `useDatabaseSetup` | Initialize schema on first load            |
| `useScenario`      | Scenario state, navigation, isolation sync |

## Related Decisions

- [ADR-001](../../docs/adr/001-zustand-over-context-redux.md) — Why Zustand for state
- [ADR-004](../../docs/adr/004-three-terminals.md) — Why three terminals
- [ADR-005](../../docs/adr/005-scenarios-on-frontend.md) — Why scenarios on frontend
