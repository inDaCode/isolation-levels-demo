# Isolation Levels Demo

## Project Purpose

Interactive educational tool demonstrating PostgreSQL transaction isolation levels.
Target audience: developers learning database concepts.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 19, TypeScript, Shadcn/ui, Tailwind, Monaco Editor
- **Backend**: NestJS, TypeScript, Socket.io, node-postgres (pg)
- **Database**: PostgreSQL 16

## Architecture

### Frontend (apps/frontend)

- Two SQL terminals (Monaco Editor)
- Each terminal = separate database session
- WebSocket connection for real-time results
- SQL presets toolbar with educational tooltips
- Activity log per terminal
- Committed Data panel with change highlighting

### Backend (apps/backend)

- WebSocket gateway for terminal sessions
- Each session maintains its own pg connection
- Explicit transaction management (BEGIN/COMMIT/ROLLBACK)
- Autocommit for queries outside explicit transactions
- Broadcast committed data to all clients after changes

## Key Concepts

| Isolation Level  | Dirty Read | Non-repeatable Read | Phantom Read |
| ---------------- | ---------- | ------------------- | ------------ |
| Read Uncommitted | Possible   | Possible            | Possible     |
| Read Committed   | No         | Possible            | Possible     |
| Repeatable Read  | No         | No                  | Possible\*   |
| Serializable     | No         | No                  | No           |

\*PostgreSQL's Repeatable Read actually prevents phantoms too

## Project Structure

```
isolation-levels-demo/
├── apps/
│   ├── backend/              # NestJS WebSocket server
│   │   └── src/
│   │       ├── database/     # SessionManagerService
│   │       └── gateway/      # TerminalGateway (WebSocket)
│   └── frontend/             # React app
│       └── src/
│           ├── components/
│           │   ├── layout/         # Header
│           │   ├── terminal/       # TerminalPanel, SqlPresets, IsolationSelect
│           │   └── database-state/ # DatabaseState (committed data view)
│           └── hooks/              # useSocket, useSession, useCommittedData
├── packages/
│   └── shared/               # Shared types (@isolation-demo/shared)
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## API Design

### WebSocket Events

Client → Server:

- `session:create` → creates new pg connection with isolation level
- `session:execute` → { sessionId, sql } — executes SQL, handles BEGIN/COMMIT/ROLLBACK
- `session:commit` → { sessionId } — commits transaction
- `session:rollback` → { sessionId } — rolls back transaction
- `session:setIsolation` → { sessionId, level } — changes isolation level (only outside transaction)
- `setup:execute` → { sql } — resets database schema
- `data:getCommitted` → { table } — fetches current committed data

Server → Client:

- `session:created` → { sessionId, state }
- `session:result` → { sessionId, result, error, state }
- `data:committed` → { table, rows } — broadcast after commits/autocommits

## Data Flow

```
Terminal executes query
        ↓
    Gateway receives
        ↓
    SessionManager executes on PG connection
        ↓
    Returns result + updated state
        ↓
    If autocommit (not in transaction):
        → Broadcast data:committed to ALL clients
        ↓
    DatabaseState updates for everyone
```

## Conventions

- kebab-case for files
- One component/class per file
- Colocate tests: `*.spec.ts` next to source
- Types imported with `import type` when type-only

## Commands

- `pnpm dev` — start all
- `docker-compose up -d` — start postgres
- `pnpm dev:backend` — backend only
- `pnpm dev:frontend` — frontend only

## Roadmap

### v1.0 (current)

- [x] Two parallel SQL terminals
- [x] Isolation level selection with descriptions
- [x] Real-time committed state view with change highlighting
- [x] SQL presets with educational tooltips
- [x] Activity log per terminal
- [ ] Explanation panel
- [ ] Preset scenarios (step-by-step demos)

### v2.0

- Uncommitted data visualization (per-session broadcast)
- Lock monitoring (`pg_locks`)
- Deadlock detection and visualization
- EXPLAIN ANALYZE visualization
