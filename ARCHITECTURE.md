# Isolation Levels Demo

## Project Purpose

Interactive educational tool demonstrating PostgreSQL transaction isolation levels.
Target audience: developers learning database concepts.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 18, TypeScript, Shadcn/ui, Tailwind, Monaco Editor
- **Backend**: NestJS, TypeScript, Socket.io, node-postgres (pg)
- **Database**: PostgreSQL 16

## Architecture

### Frontend (apps/frontend)

- Two SQL terminals (Monaco Editor)
- Each terminal = separate database session
- WebSocket connection for real-time results
- Educational tooltips explaining what happens

### Backend (apps/backend)

- WebSocket gateway for terminal sessions
- Each session maintains its own pg connection
- Transaction state management per session
- Preset scenarios for common isolation phenomena

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
├── packages/
│   └── shared/               # Shared types (@isolation-demo/shared)
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## API Design

### WebSocket Events

Client → Server:

- `session:create` → creates new pg connection
- `session:execute` → { sessionId, sql }
- `session:commit` → { sessionId }
- `session:rollback` → { sessionId }
- `session:setIsolation` → { sessionId, level }

Server → Client:

- `session:created` → { sessionId }
- `session:result` → { sessionId, rows, rowCount, error }
- `session:status` → { sessionId, inTransaction, isolationLevel }
- `data:committed` → { table, rows }

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

### v1.0

- Two parallel SQL terminals
- Isolation level selection
- Real-time committed state view
- Educational tooltips
- Preset scenarios

### v2.0

- EXPLAIN ANALYZE visualization
- Real-time lock monitoring (`pg_locks`)
- Deadlock detection and visualization
