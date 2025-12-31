# Frontend Architecture

## Overview

React SPA для демонстрации уровней изоляции PostgreSQL. Текущий режим: Sandbox (свободный ввод). Scenarios (пошаговые демонстрации) — в планах.

## Core Concepts

### Independent Terminal Sessions

- Каждый терминал = отдельная PostgreSQL сессия
- Каждый терминал имеет свой уровень изоляции
- Позволяет экспериментировать с разными уровнями одновременно

### Explicit Transactions

- Запросы вне транзакции выполняются в autocommit режиме
- BEGIN явно открывает транзакцию с выбранным isolation level
- COMMIT/ROLLBACK закрывают транзакцию

### Committed Data as Source of Truth

- Database State показывает только committed данные
- Подсветка изменений: жёлтая — изменённые ячейки, зелёная — новые строки
- Broadcast всем клиентам после commit и autocommit

## Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   └── header.tsx              # Logo, connection status, Reset DB
│   │
│   ├── terminal/
│   │   ├── terminal-panel.tsx      # Monaco editor + controls + activity log
│   │   ├── query-result.tsx        # Query results table / error display
│   │   ├── sql-presets.tsx         # SELECT/UPDATE/LOCK dropdown menus
│   │   └── isolation-select.tsx    # Isolation level dropdown with descriptions
│   │
│   ├── database-state/
│   │   └── database-state.tsx      # Committed data tables with change highlighting
│   │
│   └── ui/                         # Shadcn/ui components
│
├── hooks/
│   ├── use-socket.ts               # Socket.io connection management
│   ├── use-session.ts              # Terminal session state + activity log
│   ├── use-committed-data.ts       # Committed data + change detection
│   └── use-database-setup.ts       # Initial schema setup
│
├── lib/
│   └── socket-client.ts            # Socket.io instance
│
└── App.tsx                         # Main layout, orchestrates components
```

## State Management

React hooks, без внешних state managers.

```
App
├── useSocket()                    # Connection status
├── useDatabaseSetup()             # Schema initialization
├── TerminalPanel × 2
│   └── useSession()               # Per-terminal: state, results, log
└── DatabaseState
    └── useCommittedData()         # Committed data + change tracking
```

### Почему нет Zustand/Redux

- Терминалы независимы, не шарят состояние
- Committed data приходит через WebSocket broadcast
- Нет необходимости в cross-component state

### Когда понадобится store

Если добавим отображение uncommitted данных в общем окне — потребуется централизованное хранилище или broadcast per-session данных через WebSocket (предпочтительнее).

## Data Flow

### Query Execution

```
User clicks Run
       │
       ▼
useSession.execute(sql)
       │
       ▼
WebSocket: session:execute ──────► Backend
       │                              │
       │                              ▼
       │                         SessionManager.executeQuery()
       │                              │
       ▼                              │
WebSocket: response ◄────────────────┘
       │
       ├── Update lastResult / lastError
       ├── Update state (inTransaction)
       └── Add to activity log
```

### Committed Data Broadcast

```
Terminal commits (or autocommit)
       │
       ▼
Backend: broadcastCommittedData()
       │
       ▼
WebSocket: data:committed ──────► ALL clients
       │
       ▼
useCommittedData receives event
       │
       ├── Detect changes vs previous data
       ├── Update changedCells (for highlighting)
       └── Clear highlight after 2 seconds
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL Isolation Levels Demo         ● connected [Reset]│
├─────────────────────────────────────────────────────────────┤
│  📊 Committed Data                                          │
│  ┌─ accounts ──────────┐  ┌─ products ─────────┐            │
│  │ id │ name  │ balance│  │ id │ name  │ stock │            │
│  │ 1  │ Alice │ [1000] │  │ 1  │ Widget│  100  │            │
│  │ 2  │ Bob   │  500   │  └────────────────────┘            │
│  └─────────────────────┘   (yellow = just changed)          │
├─────────────────────────────────────────────────────────────┤
│  ┌─ Terminal 1 ─────────────┐  ┌─ Terminal 2 ─────────────┐ │
│  │ Terminal 1    ● Idle     │  │ Terminal 2    ● In Txn   │ │
│  │ [READ COMMITTED ▼]       │  │ [REPEATABLE READ ▼]      │ │
│  │ [SELECT▼][UPDATE▼][LOCK▼]│  │ [SELECT▼][UPDATE▼][LOCK▼]│ │
│  │ ┌─────────────────────┐  │  │ ┌─────────────────────┐  │ │
│  │ │ SELECT * FROM       │  │  │ │ BEGIN;              │  │ │
│  │ │ accounts;           │  │  │ │ SELECT * FROM       │  │ │
│  │ └─────────────────────┘  │  │ └─────────────────────┘  │ │
│  │ [BEGIN] [Run] [Commit]   │  │ [BEGIN] [Run] [Commit]   │ │
│  │         [Rollback]       │  │         [Rollback]       │ │
│  │ ┌─ Activity Log ───────┐ │  │ ┌─ Activity Log ───────┐ │ │
│  │ │ 12:34:56 SELECT → 3  │ │  │ │ 12:34:58 BEGIN (RR)  │ │ │
│  │ │ 12:34:52 Session     │ │  │ │ 12:34:55 Session     │ │ │
│  │ └──────────────────────┘ │  │ └──────────────────────┘ │ │
│  │ ┌─ Results ────────────┐ │  │ ┌─ Results ────────────┐ │ │
│  │ │ id │ name  │ balance │ │  │ │ id │ name  │ balance │ │ │
│  │ │ 1  │ Alice │  1000   │ │  │ │ 1  │ Alice │  1000   │ │ │
│  │ └──────────────────────┘ │  │ └──────────────────────┘ │ │
│  └──────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## SQL Presets

Dropdown-меню с готовыми запросами для быстрого тестирования:

| Category | Queries                                              | Purpose       |
| -------- | ---------------------------------------------------- | ------------- |
| SELECT   | `SELECT *`, `WHERE id=1`, `balance`                  | Basic reads   |
| UPDATE   | `+100`, `-100`, `INSERT`, `DELETE`                   | Modifications |
| LOCK     | `FOR UPDATE`, `SKIP LOCKED`, `FOR SHARE`, `pg_sleep` | Lock demos    |

Каждый preset имеет tooltip с объяснением.
LOCK категория имеет примечание: "Locks work the same on all isolation levels".

## Activity Log

Каждый терминал ведёт лог последних 10 действий:

- Timestamp (HH:MM:SS)
- Сообщение (query preview, BEGIN, COMMIT, error)
- Цветовая индикация: info (серый), success (зелёный), warning (жёлтый), error (красный)

Новые записи сверху.

## Error Handling

- **Socket disconnection** → показываем "Connecting...", disable controls
- **Query error** → показываем в Results, добавляем в log, сессия остаётся
- **Transaction error** → автоматический ROLLBACK, сессия сбрасывается

## Styling

- Tailwind CSS + Shadcn/ui
- Dark theme (zinc-900 background)
- Monospace font для SQL и результатов
- Цветовое кодирование:
  - 🟢 Green — success, committed, new rows
  - 🟡 Yellow — in transaction, warning, changed cells
  - 🔴 Red — error
  - ⚪ Gray — idle, info

## Planned Features

### Explanation Panel

Контекстные подсказки под терминалами, объясняющие что происходит при текущем isolation level.

### Scenarios Mode

Пошаговые демонстрации isolation phenomena:

```typescript
interface Scenario {
  id: string;
  name: string;
  description: string;
  isolationLevels: {
    terminal1: IsolationLevel;
    terminal2: IsolationLevel;
  };
  steps: ScenarioStep[];
}

interface ScenarioStep {
  terminal: 'terminal1' | 'terminal2';
  sql: string;
  explanation: string;
}
```

| Scenario            | Shows Problem At | Fixed At                  |
| ------------------- | ---------------- | ------------------------- |
| Non-repeatable Read | READ COMMITTED   | REPEATABLE READ           |
| Phantom Read        | READ COMMITTED   | REPEATABLE READ\*         |
| Lost Update         | READ COMMITTED   | FOR UPDATE / SERIALIZABLE |

\*PostgreSQL's REPEATABLE READ prevents phantoms unlike SQL standard
