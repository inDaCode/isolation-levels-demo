# Isolation Levels Demo — System Architecture

## Purpose

Interactive educational tool demonstrating PostgreSQL transaction isolation levels.
Target: developers learning database concurrency concepts through hands-on experimentation.

## Design Philosophy

**Show, don't tell.** Instead of explaining isolation levels with text, users run real transactions and observe the differences. Three terminals allow demonstrating complex scenarios (deadlocks, lock queues) that require multiple participants.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Terminal 1  │  │ Terminal 2  │  │ Terminal 3  │  │  Database State  │   │
│  │ Session A   │  │ Session B   │  │ Session C   │  │  (committed)     │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘   │
│         │                │                │                   │             │
│         └────────────────┴────────────────┴───────────────────┘             │
│                                   │                                         │
│                            Zustand Store                                    │
│                                   │                                         │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │ WebSocket (Socket.io)
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                              Backend (NestJS)                               │
│                                   │                                         │
│                          ┌────────┴────────┐                                │
│                          │ TerminalGateway │                                │
│                          └────────┬────────┘                                │
│                                   │                                         │
│                     ┌─────────────┴─────────────┐                           │
│                     │   SessionManagerService   │                           │
│                     └─────────────┬─────────────┘                           │
│                                   │                                         │
│              ┌────────────────────┼────────────────────┐                    │
│              │                    │                    │                    │
│        ┌─────┴─────┐        ┌─────┴─────┐        ┌─────┴─────┐              │
│        │ PG Conn A │        │ PG Conn B │        │ PG Conn C │              │
│        └─────┬─────┘        └─────┬─────┘        └─────┬─────┘              │
│              │                    │                    │                    │
└──────────────┼────────────────────┼────────────────────┼────────────────────┘
               │                    │                    │
               └────────────────────┼────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │   PostgreSQL 16   │
                          └───────────────────┘
```

## Key Design Decisions

### One WebSocket, Multiple Database Sessions

**Problem:** Each terminal needs its own PostgreSQL connection to demonstrate isolation between transactions.

**Rejected approach:** One WebSocket per terminal — complex connection management, harder to broadcast.

**Chosen approach:** Single WebSocket connection, multiple PG sessions managed server-side. Each request includes `sessionId` to route to correct connection.

**Benefits:**

- Simpler client code
- Easy broadcast to all terminals (committed data updates)
- Server controls session lifecycle

### Why Separate PG Connections (not connection pool)?

Connection pools share connections, reset state between uses. We need:

- Persistent transaction state per terminal
- Different isolation levels per session
- Ability to hold locks across multiple queries

Each terminal gets a dedicated `pg.Client` that lives for the browser session lifetime.

### Autocommit vs Explicit Transactions

**Behavior:**

- Query without `BEGIN` → autocommit (immediately visible to others)
- `BEGIN` → starts transaction with selected isolation level
- `COMMIT`/`ROLLBACK` → ends transaction

This matches real PostgreSQL behavior and helps users understand the difference.

### Broadcast on Commit

When any session commits (or autocommits), server broadcasts updated table data to ALL clients. This lets users see how their changes become visible to others.

```
Terminal 1: UPDATE accounts SET balance = 500 WHERE id = 1;
            COMMIT;
                │
                ▼
Backend: broadcastCommittedData('accounts')
                │
                ▼
All terminals: DatabaseState panel updates with highlighted changes
```

## Tech Stack

| Layer      | Technology           | Why                                                    |
| ---------- | -------------------- | ------------------------------------------------------ |
| Monorepo   | pnpm workspaces      | Fast, efficient, good TypeScript support               |
| Frontend   | React 19 + Vite      | Modern, fast HMR, good DX                              |
| State      | Zustand              | Minimal API, stable references, granular subscriptions |
| UI         | Shadcn/ui + Tailwind | Consistent design, easy customization                  |
| SQL Editor | Monaco Editor        | VS Code experience, SQL syntax highlighting            |
| Backend    | NestJS               | Structured, good WebSocket support, TypeScript native  |
| WebSocket  | Socket.io            | Reliable, reconnection handling, room support          |
| Database   | PostgreSQL 16        | Industry standard, best isolation level implementation |
| DB Client  | node-postgres (pg)   | Low-level control needed for session management        |

## Project Structure

```
isolation-levels-demo/
├── apps/
│   ├── backend/                    # NestJS WebSocket server
│   │   ├── src/
│   │   │   ├── database/
│   │   │   │   └── session-manager.service.ts  # PG connection management
│   │   │   └── gateway/
│   │   │       └── terminal.gateway.ts         # WebSocket event handlers
│   │   └── ARCHITECTURE.md
│   │
│   └── frontend/                   # React SPA
│       ├── src/
│       │   ├── components/         # UI components
│       │   ├── stores/             # Zustand session store
│       │   ├── hooks/              # React hooks
│       │   └── data/               # Scenario definitions
│       └── ARCHITECTURE.md         # Frontend-specific decisions
│
├── packages/
│   └── shared/                     # @isolation-demo/shared
│       └── src/
│           ├── types.ts            # WebSocket event types
│           ├── scenarios.ts        # Scenario type definitions
│           └── setup-sql.ts        # Database schema
│
├── docker-compose.yml              # PostgreSQL container
└── pnpm-workspace.yaml
```

## WebSocket Protocol

### Client → Server

| Event                  | Payload                | Description                               |
| ---------------------- | ---------------------- | ----------------------------------------- |
| `session:create`       | `{ isolationLevel? }`  | Create new PG connection                  |
| `session:execute`      | `{ sessionId, sql }`   | Execute SQL query                         |
| `session:commit`       | `{ sessionId }`        | Commit transaction                        |
| `session:rollback`     | `{ sessionId }`        | Rollback transaction                      |
| `session:setIsolation` | `{ sessionId, level }` | Change isolation level (outside txn only) |
| `setup:execute`        | `{ sql }`              | Reset database schema                     |
| `data:getCommitted`    | `{ table }`            | Fetch current committed data              |

### Server → Client

| Event             | Payload                                 | Description                |
| ----------------- | --------------------------------------- | -------------------------- |
| `session:created` | `{ sessionId, state }`                  | Session ready              |
| `session:result`  | `{ sessionId, result?, error?, state }` | Query result or error      |
| `data:committed`  | `{ table, rows }`                       | Broadcast after any commit |

### Session State

```typescript
interface SessionState {
  sessionId: string;
  isolationLevel: IsolationLevel;
  inTransaction: boolean;
}

type IsolationLevel = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
```

## Data Flow Examples

### Scenario: Non-Repeatable Read

```
Terminal 1                    Terminal 2                    Database
    │                             │                            │
    │ BEGIN (READ COMMITTED)      │                            │
    ├────────────────────────────►│                            │
    │                             │                            │
    │ SELECT balance WHERE id=1   │                            │
    ├────────────────────────────►│◄───────────────────────────┤
    │ ◄─── returns 1000           │                            │
    │                             │                            │
    │                             │ UPDATE balance = 500       │
    │                             ├───────────────────────────►│
    │                             │ COMMIT                     │
    │                             ├───────────────────────────►│
    │                             │                            │
    │ SELECT balance WHERE id=1   │                            │
    ├────────────────────────────►│◄───────────────────────────┤
    │ ◄─── returns 500 (changed!) │                            │
    │                             │                            │
```

### Scenario: Deadlock Detection

```
Terminal 1                    Terminal 2                    PostgreSQL
    │                             │                            │
    │ BEGIN                       │ BEGIN                      │
    │ UPDATE WHERE id=1           │ UPDATE WHERE id=2          │
    │ (holds lock on row 1)       │ (holds lock on row 2)      │
    │                             │                            │
    │ UPDATE WHERE id=2           │                            │
    │ (waits for row 2)───────────┼───────────────────────────►│
    │                             │                            │
    │                             │ UPDATE WHERE id=1          │
    │◄────────────────────────────┼──(waits for row 1)         │
    │                             │                            │
    │                             │        DEADLOCK DETECTED   │
    │                             │◄───────────────────────────┤
    │                             │ ERROR: deadlock, txn abort │
    │                             │                            │
    │ (lock acquired, continues)  │                            │
```

## Conventions

- **File naming:** kebab-case (`session-store.ts`, `terminal-panel.tsx`)
- **Components:** One per file, named export matches filename
- **Tests:** Colocated (`*.spec.ts` next to source)
- **Types:** Use `import type` for type-only imports
- **Shared types:** All WebSocket types in `@isolation-demo/shared`

## Development

```bash
# Start PostgreSQL
docker-compose up -d

# Install dependencies
pnpm install

# Start all (backend + frontend)
pnpm dev

# Or separately
pnpm dev:backend    # http://localhost:3000
pnpm dev:frontend   # http://localhost:5173
```

## Detailed Documentation

- [Frontend Architecture](./apps/frontend/ARCHITECTURE.md) — React components, Zustand store, state management decisions
- Backend Architecture — (planned) Session management, WebSocket gateway details
