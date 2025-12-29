# Frontend Architecture

## Overview

React SPA для демонстрации уровней изоляции PostgreSQL. Два режима: Sandbox (свободный ввод) и Scenarios (пошаговые демонстрации).

## Core Concepts

### Single Isolation Level

Один уровень изоляции на всё приложение. Обе сессии работают с одинаковым уровнем — это отражает реальную практику и упрощает сравнение.

### Two Terminals, One Truth

- Каждый терминал = отдельная PostgreSQL сессия
- Database State показывает что видит каждая сессия + committed данные
- Разница между "что вижу я" и "что в БД" — суть демонстрации

## Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   └── app-shell.tsx           # Main layout, mode switcher, global controls
│   │
│   ├── terminal/
│   │   ├── terminal-panel.tsx      # Monaco editor + controls + status
│   │   ├── terminal-controls.tsx   # Run, BEGIN, COMMIT, ROLLBACK buttons
│   │   └── terminal-status.tsx     # Connection state, in-transaction indicator
│   │
│   ├── database-state/
│   │   ├── database-state.tsx      # Main comparison table
│   │   ├── table-view.tsx          # Single table with visibility columns
│   │   └── metrics-bar.tsx         # Timing, retries, errors
│   │
│   ├── scenarios/
│   │   ├── scenario-selector.tsx   # Dropdown with scenario list
│   │   ├── scenario-stepper.tsx    # Step navigation + explanation
│   │   └── scenario-explanation.tsx # Contextual hints
│   │
│   └── shared/
│       ├── isolation-select.tsx    # Global isolation level dropdown
│       └── status-badge.tsx        # ⚪🟡🔴 indicators
│
├── hooks/
│   ├── use-socket.ts               # Socket.io connection management
│   ├── use-session.ts              # Single terminal session state
│   ├── use-scenario.ts             # Scenario orchestration
│   └── use-database-state.ts       # Committed + session views
│
├── lib/
│   ├── socket-client.ts            # Socket.io instance
│   └── scenarios.ts                # Scenario definitions
│
└── types/
    └── index.ts                    # Re-exports from @isolation-demo/shared
```

## State Management

Нет Redux/Zustand — достаточно React hooks + Context.

```
AppShell
├── useSocket()                    # Connection status
├── useSession() × 2               # Terminal 1 & 2 state
├── useScenario(t1, t2)            # Orchestrates both terminals
├── useDatabaseState()             # What each session sees
│
└── Context: IsolationLevelContext # Global isolation level
```

## Data Flow

```
User Action (Run SQL)
       │
       ▼
useSession.execute(sql)
       │
       ▼
WebSocket: session:execute ──────► Backend
       │                              │
       │                              ▼
       │                         PostgreSQL
       │                              │
       ▼                              │
WebSocket: session:result ◄──────────┘
       │
       ▼
Update terminal.lastResult
       │
       ▼
useDatabaseState.updateSessionView()
       │
       ▼
Re-render Database State table
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Isolation: [READ COMMITTED ▼]                              │
│  Mode: [Sandbox | Scenarios]                    [Reset]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Terminal 1 ─────────────┐  ┌─ Terminal 2 ─────────────┐│
│  │ Status: 🟡 IN TXN  ⏱ 12ms│  │ Status: ⚪ IDLE          ││
│  │ ┌─────────────────────┐  │  │ ┌─────────────────────┐  ││
│  │ │ Monaco Editor       │  │  │ │ Monaco Editor       │  ││
│  │ └─────────────────────┘  │  │ └─────────────────────┘  ││
│  │ [▶ Run] [BEGIN] [COMMIT] │  │ [▶ Run] [BEGIN] [COMMIT] ││
│  │         [ROLLBACK]       │  │         [ROLLBACK]       ││
│  └──────────────────────────┘  └──────────────────────────┘│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📊 What Each Session Sees                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        committed    Session 1      Session 2           │ │
│  │  Alice    1000        1500           1000              │ │
│  │                        ↑                               │ │
│  │               (uncommitted)                            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ⏱ Session 1: 24ms | Session 2: 8ms | ❌ Errors: 0        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  💡 Explanation (contextual)                                │
│  "Session 1 updated Alice but hasn't committed.             │
│   Session 2 sees old value due to READ COMMITTED."          │
│                                                             │
│  [Scenarios mode: ← Back | Step 2/5 | Next →]               │
└─────────────────────────────────────────────────────────────┘
```

## Scenarios Structure

```typescript
interface Scenario {
  id: string;
  name: string; // "Lost Update"
  description: string; // Brief explanation
  recommendedIsolation: IsolationLevel;
  showsFixAt?: IsolationLevel; // Which level prevents this
  setupSql: string[]; // Initial data
  steps: ScenarioStep[];
}

interface ScenarioStep {
  terminal: 'terminal1' | 'terminal2';
  sql: string;
  explanation: string; // What to show in 💡 panel
  highlight?: 'committed' | 'session1' | 'session2';
}
```

## Key Scenarios

| Scenario            | Shows Problem At | Fixed At                          |
| ------------------- | ---------------- | --------------------------------- |
| Non-repeatable Read | READ COMMITTED   | REPEATABLE READ                   |
| Phantom Read        | READ COMMITTED   | REPEATABLE READ\*                 |
| Lost Update         | READ COMMITTED   | SELECT FOR UPDATE or SERIALIZABLE |
| Serialization Error | SERIALIZABLE     | (expected behavior)               |

\*PostgreSQL's REPEATABLE READ prevents phantoms unlike SQL standard

## Metrics Tracked

- **Query duration** — shows performance trade-offs
- **Serialization errors** — cost of SERIALIZABLE
- **Blocked time** — when waiting for locks (FOR UPDATE)

## Error Handling

- Socket disconnection → show reconnecting state, disable controls
- Query error → show in terminal, keep session alive
- Session lost → prompt to recreate
- Scenario step failed → show error, allow retry

## Styling

- Tailwind CSS + Shadcn/ui components
- Dark theme (developer tool aesthetic)
- Monospace font for SQL and results
- Color coding: green=committed, yellow=uncommitted, red=error
