# Backend Architecture

## Overview

NestJS WebSocket server managing PostgreSQL sessions. Each terminal has a dedicated database connection with independent transaction state and isolation level.

## Structure

```
src/
├── database/
│   ├── database.module.ts            # Database module
│   ├── session-manager.service.ts    # PG connection lifecycle
│   ├── session-manager.types.ts      # Types and constants
│   └── setup.sql.ts                  # Database setup SQL
├── gateway/
│   ├── gateway.module.ts             # Gateway module
│   └── terminal.gateway.ts           # WebSocket event handlers
├── app.module.ts
└── main.ts
```

## Components

### TerminalGateway

WebSocket gateway handling all client events. Fully typed with `ClientToServerEvents` / `ServerToClientEvents`.

Responsibilities:

- Handle connection/disconnection
- Route session commands (create, execute, commit, rollback)
- Broadcast committed data to all clients

### SessionManagerService

Manages PostgreSQL connections:

- **3 dedicated connections** — one per terminal (T1, T2, T3)
- **1 utility connection** — for reading committed data and setup

Responsibilities:

- Create/destroy PG connections per terminal
- Execute SQL with transaction handling
- Track modified rows during transactions
- Return uncommitted snapshots with modification info
- Track session state (isolation level, in-transaction)

See [ADR-003](../../docs/adr/003-dedicated-connections-over-pool.md) for why dedicated connections.

## WebSocket Protocol

Fully typed — see `@isolation-demo/shared` for `ClientToServerEvents` and `ServerToClientEvents`.

### Client → Server

| Event                  | Payload                      | Description            |
| ---------------------- | ---------------------------- | ---------------------- |
| `session:create`       | `{ terminalId, isolation? }` | Create PG connection   |
| `session:execute`      | `{ sessionId, sql }`         | Execute SQL query      |
| `session:commit`       | `{ sessionId }`              | Commit transaction     |
| `session:rollback`     | `{ sessionId }`              | Rollback transaction   |
| `session:setIsolation` | `{ sessionId, level }`       | Change isolation level |
| `database:reset`       | —                            | Reset database schema  |
| `data:getCommitted`    | `{ table }`                  | Fetch committed data   |

### Server → Client

| Event             | Payload                                       | Description             |
| ----------------- | --------------------------------------------- | ----------------------- |
| `session:created` | `{ sessionId, state }`                        | Session ready           |
| `session:result`  | `{ sessionId, result?, error?, uncommitted?}` | Query result + snapshot |
| `data:committed`  | `{ table, rows }`                             | Broadcast after commit  |

## Modified Rows Tracking

Each session tracks which rows were modified during the current transaction:

```typescript
interface ActiveSession {
  client: Client;
  state: SessionState;
  terminalId: TerminalId;
  modifiedRows: {
    accounts: Set<string>;
    products: Set<string>;
  };
}
```

### How It Works

1. Before executing a query, snapshot current table state
2. Execute the query
3. After execution, snapshot table state again
4. Compare snapshots to detect which rows changed (INSERT/UPDATE/DELETE)
5. Add changed row IDs to `modifiedRows` set

This allows frontend to distinguish between:

- Rows the terminal actually modified (show as pending changes)
- Rows the terminal sees differently due to isolation level (don't show)

### Lifecycle

- `BEGIN` — clear `modifiedRows` (new transaction starts fresh)
- `COMMIT` / `ROLLBACK` — clear `modifiedRows`
- Query execution — accumulate modified rows
- Error with rollback — clear `modifiedRows`

## Uncommitted Snapshots

When executing queries in a transaction, the response includes an `uncommitted` snapshot:

```typescript
interface UncommittedSnapshot {
  terminalId: 1 | 2 | 3;
  tables: {
    accounts: Record<string, unknown>[];
    products: Record<string, unknown>[];
  };
  modifiedRows: {
    accounts: string[]; // Row IDs modified by this transaction
    products: string[];
  };
}
```

This allows the frontend to show only actual pending changes before commit.

## Session State

```typescript
interface SessionState {
  sessionId: string;
  isolationLevel: IsolationLevel;
  inTransaction: boolean;
  createdAt: Date;
}

type IsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';
```

## Transaction Handling

### Explicit Transactions

```
BEGIN                    → inTransaction: true, clear modifiedRows, return snapshot
  SELECT/UPDATE/etc      → track modified rows, return snapshot
COMMIT/ROLLBACK          → inTransaction: false, clear modifiedRows
```

### Autocommit

```
SELECT/UPDATE (no BEGIN) → executes immediately, commits
                         → broadcast committed data
```

### Isolation Level Changes

- Only allowed outside transactions
- Applied via `BEGIN ISOLATION LEVEL ...` on next transaction start

## Error Handling

| Error Type            | Handling                                             |
| --------------------- | ---------------------------------------------------- |
| Connection failed     | Return error, cleanup session                        |
| Query syntax error    | Return PG error message, rollback, clear modified    |
| Deadlock detected     | PG aborts transaction, auto-rollback, clear modified |
| Serialization failure | PG aborts transaction, auto-rollback, clear modified |
| Lock timeout          | Return error, session remains valid                  |

## Connection Lifecycle

```
Client connects (WebSocket)
         │
         ▼
Client: session:create { terminalId: 1, isolationLevel: "READ COMMITTED" }
         │
         ▼
SessionManagerService.createSession(terminalId, isolationLevel)
         │
         ├── new pg.Client()
         ├── client.connect()
         ├── Store: { client, state, terminalId, modifiedRows: empty }
         │
         ▼
Client: session:created { sessionId, state }
         │
         ▼
    ... queries with uncommitted snapshots + modifiedRows ...
         │
         ▼
Client disconnects (WebSocket)
         │
         ▼
SessionManagerService.closeSession(sessionId)
         │
         └── ROLLBACK if in transaction, then close
```
