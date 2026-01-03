# Frontend Architecture

## Overview

React SPA для демонстрации уровней изоляции PostgreSQL. Два режима работы:

- **Sandbox** — свободный ввод и эксперименты
- **Scenarios** — пошаговые guided-демонстрации isolation phenomena

## Core Concepts

### Independent Terminal Sessions

- **3 терминала** = 3 отдельные PostgreSQL сессии
- Каждый терминал имеет свой уровень изоляции
- Позволяет демонстрировать chain deadlock и lock queue (требуют 3 участников)

### Explicit Transactions

- Запросы вне транзакции выполняются в autocommit режиме
- BEGIN явно открывает транзакцию с выбранным isolation level
- COMMIT/ROLLBACK закрывают транзакцию

### Committed Data as Source of Truth

- Database State показывает только committed данные
- Подсветка изменений: жёлтая — изменённые ячейки, зелёная — новые строки
- Broadcast всем клиентам после commit и autocommit

### Guided Scenarios

- Пользователь выполняет шаги вручную (не автоматизация)
- ScenarioPanel показывает инструкции и SQL для копирования
- Терминалы остаются полностью функциональными

## Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   └── header.tsx              # Logo, scenario select, connection status
│   │
│   ├── terminal/
│   │   ├── terminal-panel.tsx      # Monaco editor + controls + activity log (forwardRef)
│   │   ├── query-result.tsx        # Query results table / error display
│   │   ├── sql-presets.tsx         # SELECT/UPDATE/LOCK vertical dropdown menus
│   │   └── isolation-select.tsx    # Isolation level dropdown with descriptions
│   │
│   ├── database-state/
│   │   └── database-state.tsx      # Committed data tables + Reset button
│   │
│   ├── explanation/
│   │   └── explanation-panel.tsx   # Welcome message in Sandbox mode
│   │
│   ├── scenario/
│   │   ├── scenario-select.tsx     # Dropdown для выбора сценария
│   │   └── scenario-panel.tsx      # Step-by-step instructions
│   │
│   └── ui/                         # Shadcn/ui components
│
├── data/
│   └── scenarios.ts                # Scenario definitions (типы в shared)
│
├── hooks/
│   ├── use-socket.ts               # Socket.io connection management
│   ├── use-session.ts              # Terminal session state + activity log
│   ├── use-committed-data.ts       # Committed data + change detection
│   ├── use-database-setup.ts       # Initial schema setup
│   └── use-scenario.ts             # Scenario state management
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
├── useScenario()                  # Current scenario, step navigation
├── terminalRefs                   # Refs для управления терминалами из сценариев
├── TerminalPanel × 3
│   └── useSession()               # Per-terminal: state, results, log
└── DatabaseState
    └── useCommittedData()         # Committed data + change tracking
```

### Почему нет Zustand/Redux

- Терминалы независимы, не шарят состояние
- Committed data приходит через WebSocket broadcast
- Сценарии управляют терминалами через refs, не через shared state
- Нет необходимости в cross-component state

### Когда понадобится store

Если добавим отображение uncommitted данных в общем окне — потребуется централизованное хранилище или broadcast per-session данных через WebSocket (предпочтительнее).

## Data Flow

### Query Execution

```
User clicks Run (or Ctrl+Enter)
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
       ├── Update lastWasTransactionCommand
       └── Add to activity log
```

### Scenario Step Execution

```
User clicks "Copy to T1" in ScenarioPanel
       │
       ▼
App.handleCopyToTerminal(1, sql)
       │
       ▼
terminalRefs.current[1].setSql(sql)
       │
       ▼
Terminal 1 editor updates, user clicks Run manually
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
┌─────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL Isolation Demo     [Scenario: Deadlock ▼]         ● Connected   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─ Step 3 of 6 ────────────────────────────────────────────────────────┐   │
│  │  Terminal 1 holds lock on row 1...                                   │   │
│  │  👉 Execute in Terminal 1:                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ UPDATE accounts SET balance = 100 WHERE id = 2;                 │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │  [Copy to T1]                                   [← Back] [Next →]    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 Committed Data                                                  [Reset] │
│  ┌─ accounts ──────────┐  ┌─ products ─────────┐                           │
│  │ id │ name  │ balance│  │ id │ name  │ stock │                           │
│  └─────────────────────┘  └─────────────────────┘                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Terminal 1 ────────┐ ┌─ Terminal 2 ────────┐ ┌─ Terminal 3 ────────┐    │
│ │ ● Idle [READ COM▼]  │ │ ● In Txn [READ C▼]  │ │ ● Idle [READ COM▼]  │    │
│ │ ┌─ Transaction ───┐ │ │ ┌─ Transaction ───┐ │ │ ┌─ Transaction ───┐ │    │
│ │ │[BEGIN] [COMMIT] │ │ │ │[BEGIN] [COMMIT] │ │ │ │[BEGIN] [COMMIT] │ │    │
│ │ │       [ROLLBACK]│ │ │ │       [ROLLBACK]│ │ │ │       [ROLLBACK]│ │    │
│ │ └─────────────────┘ │ │ └─────────────────┘ │ │ └─────────────────┘ │    │
│ │ Presets │ Query     │ │ Presets │ Query     │ │ Presets │ Query     │    │
│ │ [SEL▼]  │ ┌───────┐ │ │ [SEL▼]  │ ┌───────┐ │ │ [SEL▼]  │ ┌───────┐ │    │
│ │ [UPD▼]  │ │ SQL   │ │ │ [UPD▼]  │ │ SQL   │ │ │ [UPD▼]  │ │ SQL   │ │    │
│ │ [LOC▼]  │ └───────┘ │ │ [LOC▼]  │ └───────┘ │ │ [LOC▼]  │ └───────┘ │    │
│ │         [Run ▶]     │ │         [Run ▶]     │ │         [Run ▶]     │    │
│ │ Activity Log        │ │ Activity Log        │ │ Activity Log        │    │
│ │ Results             │ │ Results             │ │ Results             │    │
│ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## SQL Presets

Вертикальные dropdown-меню слева от редактора:

| Category | Queries                                              | Purpose       |
| -------- | ---------------------------------------------------- | ------------- |
| SELECT   | `SELECT *`, `WHERE id=1`, `balance`                  | Basic reads   |
| UPDATE   | `+100`, `-100`, `INSERT`, `DELETE`                   | Modifications |
| LOCK     | `FOR UPDATE`, `SKIP LOCKED`, `FOR SHARE`, `pg_sleep` | Lock demos    |

Каждый preset имеет tooltip с объяснением.

## Activity Log

Каждый терминал показывает последние 3 действия:

- Timestamp (HH:MM:SS)
- Сообщение (query preview, BEGIN, COMMIT, error)
- Цветовая индикация: info (серый), success (зелёный), warning (жёлтый), error (красный)

Новые записи сверху. Полный лог хранит 10 записей.

## Scenarios

Типы определены в `@isolation-demo/shared`, данные в `src/data/scenarios.ts`.

```typescript
interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  terminals: 2 | 3;
  setup: {
    isolationLevels: [IsolationLevel, IsolationLevel, IsolationLevel?];
  };
  steps: ScenarioStep[];
  conclusion: {
    problem: string;
    solution: string;
  };
}

interface ScenarioStep {
  terminal: 1 | 2 | 3;
  sql: string;
  explanation: string;
  expectation?: string; // Warning/info about expected result
}
```

### Реализованные сценарии

| Scenario            | Terminals | Difficulty   | Shows                                     |
| ------------------- | --------- | ------------ | ----------------------------------------- |
| Non-repeatable Read | 2         | Basic        | READ COMMITTED не защищает от изменений   |
| Deadlock            | 2         | Intermediate | Взаимная блокировка, PostgreSQL detection |

### Планируемые сценарии

| Scenario       | Terminals | Difficulty   | Shows                               |
| -------------- | --------- | ------------ | ----------------------------------- |
| Phantom Read   | 2         | Basic        | INSERT виден в той же транзакции    |
| Lost Update    | 2         | Intermediate | Потеря обновления без FOR UPDATE    |
| Chain Deadlock | 3         | Advanced     | Циклическая блокировка 3 сессий     |
| Lock Queue     | 3         | Advanced     | Одна транзакция блокирует остальных |

## Error Handling

- **Socket disconnection** → показываем "Connecting...", disable controls
- **Query error** → показываем в Results, добавляем в log, сессия остаётся
- **Transaction error** → автоматический ROLLBACK на backend, сессия сбрасывается

## Styling

- Tailwind CSS + Shadcn/ui
- Dark theme (zinc-900 background)
- Monospace font для SQL и результатов
- Цветовое кодирование:
  - 🟢 Green — success, committed, new rows, active transaction
  - 🟡 Yellow — in transaction status, warning, changed cells
  - 🔴 Red — error
  - 🔵 Blue — scenario panel
  - ⚪ Gray — idle, info

## Known Issues

- **"Run in Terminal" из сценария** — временно отключён, требует отладки timing между setSql и execute
