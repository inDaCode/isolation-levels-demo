# Backend Architecture

## Overview

NestJS WebSocket server managing PostgreSQL sessions. Each connected client can create multiple database sessions with independent transaction states and isolation levels.

## Structure

```
src/
├── database/
│   └── session-manager.service.ts  # PG connection lifecycle
├── gateway/
│   └── terminal.gateway.ts         # WebSocket event handlers
├── app.module.ts
└── main.ts
```

## Components

### TerminalGateway

WebSocket gateway handling all client events. Routes requests to SessionManagerService based on `sessionId`.

Responsibilities:

- Handle connection/disconnection
- Route session commands (create, execute, commit, rollback)
- Broadcast committed data to all clients

### SessionManagerService

Manages PostgreSQL connections. One `pg.Client` per terminal session.

Responsibilities:

- Create/destroy PG connections
- Execute SQL with proper transaction handling
- Track session state (isolation level, in-transaction)
- Detect autocommit vs explicit transactions

See [ADR-003](../../docs/adr/003-dedicated-connections-over-pool.md) for why dedicated connections instead of pool.

## WebSocket Protocol

### Client to Server

| Event                  | Payload                | Description              |
| ---------------------- | ---------------------- | ------------------------ |
| `session:create`       | `{ isolationLevel? }`  | Create new PG connection |
| `session:execute`      | `{ sessionId, sql }`   | Execute SQL query        |
| `session:commit`       | `{ sessionId }`        | Commit transaction       |
| `session:rollback`     | `{ sessionId }`        | Rollback transaction     |
| `session:setIsolation` | `{ sessionId, level }` | Change isolation level   |
| `setup:execute`        | `{ sql }`              | Reset database schema    |
| `data:getCommitted`    | `{ table }`            | Fetch committed data     |

### Server to Client

| Event             | Payload                                 | Description                |
| ----------------- | --------------------------------------- | -------------------------- |
| `session:created` | `{ sessionId, state }`                  | Session ready              |
| `session:result`  | `{ sessionId, result?, error?, state }` | Query result or error      |
| `data:committed`  | `{ table, rows }`                       | Broadcast after any commit |

## Session State

```typescript
interface SessionState {
  sessionId: string;
  isolationLevel: IsolationLevel;
  inTransaction: boolean;
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
BEGIN                    → inTransaction: true
  SELECT/UPDATE/etc      → stays in transaction
COMMIT/ROLLBACK          → inTransaction: false
```

### Autocommit

```
SELECT/UPDATE (no BEGIN) → executes immediately, commits
                         → broadcast committed data
```

### Isolation Level Changes

- Only allowed outside transactions
- Applied via `SET TRANSACTION ISOLATION LEVEL` on next `BEGIN`

## Data Flow

### Query Execution

```
Client: session:execute { sessionId: "abc", sql: "SELECT * FROM accounts" }
                │
                ▼
TerminalGateway.handleExecute()
                │
                ▼
SessionManagerService.execute(sessionId, sql)
                │
                ├── Get pg.Client by sessionId
                ├── Execute query
                ├── Update session state
                │
                ▼
Client: session:result { sessionId, result, state }
```

### Commit Broadcast

```
Client: session:commit { sessionId: "abc" }
                │
                ▼
SessionManagerService.commit(sessionId)
                │
                ├── Execute COMMIT
                ├── Update state: inTransaction = false
                │
                ▼
TerminalGateway: broadcast data:committed to ALL clients
                │
                ▼
All clients: DatabaseState panel updates
```

## Error Handling

| Error Type            | Handling                            |
| --------------------- | ----------------------------------- |
| Connection failed     | Return error, cleanup session       |
| Query syntax error    | Return PG error message             |
| Deadlock detected     | PG aborts transaction, return error |
| Serialization failure | PG aborts transaction, return error |
| Lock timeout          | Return error, session remains valid |

## Connection Lifecycle

```
Client connects (WebSocket)
         │
         ▼
Client: session:create { isolationLevel: "READ COMMITTED" }
         │
         ▼
SessionManagerService.create()
         │
         ├── new pg.Client()
         ├── client.connect()
         ├── Store in sessions map
         │
         ▼
Client: session:created { sessionId, state }
         │
         ▼
    ... queries ...
         │
         ▼
Client disconnects (WebSocket)
         │
         ▼
SessionManagerService.destroyAll(clientId)
         │
         └── Close all pg.Client for this WebSocket
```
