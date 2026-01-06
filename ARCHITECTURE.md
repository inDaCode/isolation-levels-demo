# Isolation Levels Demo — Architecture

## Purpose

Interactive educational tool demonstrating PostgreSQL transaction isolation levels.
Target: developers learning database concurrency concepts through hands-on experimentation.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Terminal 1  │  │ Terminal 2  │  │ Terminal 3  │  │  Database State  │   │
│  │ Session A   │  │ Session B   │  │ Session C   │  │  + uncommitted   │   │
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
│        ┌──────────────────────────┼──────────────────────────┐              │
│        │                          │                          │              │
│  ┌─────┴─────┐  ┌─────────┐ ┌─────┴─────┐  ┌─────────┐ ┌─────┴─────┐       │
│  │ PG Conn A │  │ Utility │ │ PG Conn B │  │ Utility │ │ PG Conn C │       │
│  │ (T1)      │  │ Client  │ │ (T2)      │  │         │ │ (T3)      │       │
│  └─────┬─────┘  └────┬────┘ └─────┬─────┘  └─────────┘ └─────┬─────┘       │
│        │             │            │                          │              │
└────────┼─────────────┼────────────┼──────────────────────────┼──────────────┘
         │             │            │                          │
         └─────────────┴────────────┴──────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │   PostgreSQL 16   │
                          └───────────────────┘
```

## Tech Stack

| Layer      | Technology           | Purpose                                     |
| ---------- | -------------------- | ------------------------------------------- |
| Monorepo   | pnpm workspaces      | Package management                          |
| Frontend   | React 19 + Vite      | SPA with hot reload                         |
| State      | Zustand              | Terminal session + uncommitted data         |
| UI         | Shadcn/ui + Tailwind | Component library                           |
| SQL Editor | Monaco Editor        | Code editing with syntax highlighting       |
| Backend    | NestJS               | WebSocket server                            |
| WebSocket  | Socket.io (typed)    | Real-time communication                     |
| Database   | PostgreSQL 16        | All isolation levels including SERIALIZABLE |
| DB Client  | node-postgres (pg)   | Direct connection management                |

## Project Structure

```
isolation-levels-demo/
├── apps/
│   ├── backend/                    # NestJS WebSocket server
│   │   └── src/
│   │       ├── database/
│   │       │   ├── session-manager.service.ts
│   │       │   ├── session-manager.types.ts
│   │       │   └── setup.sql.ts
│   │       └── gateway/
│   │           └── terminal.gateway.ts
│   │
│   └── frontend/                   # React SPA
│       └── src/
│           ├── components/
│           │   ├── layout/         # Header with scenario dropdowns
│           │   ├── terminal/       # Terminal components (index + 7 files)
│           │   ├── database-state/ # Committed + uncommitted data view
│           │   ├── explanation/    # Info panels
│           │   └── scenario/       # Guided scenario panel
│           ├── stores/             # Zustand store
│           ├── hooks/              # React hooks
│           └── data/               # 15 scenario definitions
│
├── packages/
│   └── shared/                     # @isolation-demo/shared
│       └── src/
│           ├── index.ts
│           └── types.ts            # WebSocket types + event maps
│
├── docs/
│   └── adr/                        # Architecture Decision Records
│
├── docker-compose.yml              # PostgreSQL container
└── pnpm-workspace.yaml
```

## Key Features

### Uncommitted Data Visualization

Database State panel shows:

- **Committed data** — actual database state
- **Pending changes** — uncommitted modifications per terminal
- **Color coding** — T1 (blue), T2 (green), T3 (orange)
- **Change types** — updates (`→`), inserts (new row), deletes (`→ ∅`)

### Typed WebSocket Protocol

Full TypeScript coverage for Socket.io events:

```typescript
// Frontend
const socket: Socket<ServerToClientEvents, ClientToServerEvents>;

// Backend
server: Server<ClientToServerEvents, ServerToClientEvents>;
```

## Scenarios

15 guided scenarios across 4 categories:

| Category        | Count | Topics                                            |
| --------------- | ----- | ------------------------------------------------- |
| Read Anomalies  | 4     | Dirty read, non-repeatable read, phantom read     |
| Write Anomalies | 4     | Lost update, write skew, FOR UPDATE, SERIALIZABLE |
| Locks           | 4     | Lock wait, FOR SHARE, SKIP LOCKED, NOWAIT         |
| Deadlocks       | 3     | Basic deadlock, chain deadlock, lock queue        |

## Conventions

- **File naming:** kebab-case (`session-store.ts`)
- **Components:** Named exports, `index.tsx` as entry point
- **Types:** Use `import type` for type-only imports
- **Shared types:** All WebSocket types in `@isolation-demo/shared`

## Architecture Decisions

Key decisions documented in [docs/adr/](./docs/adr/):

- [ADR-001](./docs/adr/001-zustand-over-context-redux.md) — Zustand for state management
- [ADR-002](./docs/adr/002-single-websocket-multiple-sessions.md) — Single WebSocket architecture
- [ADR-003](./docs/adr/003-dedicated-connections-over-pool.md) — Dedicated PG connections
- [ADR-004](./docs/adr/004-three-terminals.md) — Three terminals design
- [ADR-005](./docs/adr/005-scenarios-on-frontend.md) — Frontend-stored scenarios

## Detailed Documentation

- [Frontend Architecture](./apps/frontend/ARCHITECTURE.md) — Components, state, hooks
- [Backend Architecture](./apps/backend/ARCHITECTURE.md) — WebSocket protocol, session management

## Development

```bash
docker-compose up -d    # PostgreSQL on port 5435
pnpm install
pnpm dev                # Backend :3000, Frontend :5173
```
