# Isolation Levels Demo

Interactive tool for learning PostgreSQL transaction isolation levels through hands-on experimentation.

![Demo](docs/demo.gif)

## Why This Exists

Most resources explain isolation levels with text and diagrams. This tool lets you **run real transactions** and **see the differences** — dirty reads, phantom reads, deadlocks, and more.

Three terminals allow demonstrating scenarios that require multiple participants: chain deadlocks (A→B→C→A), lock queues, and concurrent updates.

## Features

- **3 independent SQL terminals** with separate PostgreSQL connections
- **15 guided scenarios** covering read anomalies, write anomalies, locks, and deadlocks
- **Real-time committed data view** with change highlighting
- **Isolation level selector** per terminal (READ UNCOMMITTED → SERIALIZABLE)
- **Auto-setup** — isolation levels configured automatically for each scenario

## Quick Start

```bash
# Prerequisites: Docker, Node.js 18+, pnpm

# Start PostgreSQL
docker-compose up -d

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

Open http://localhost:5173

## Scenarios

| Category        | Count | What You'll See                                      |
| --------------- | ----- | ---------------------------------------------------- |
| Read Anomalies  | 4     | Dirty read protection, non-repeatable read, phantoms |
| Write Anomalies | 4     | Lost updates, write skew, SERIALIZABLE protection    |
| Locks           | 4     | Lock wait, FOR SHARE, SKIP LOCKED, NOWAIT            |
| Deadlocks       | 3     | Two-way deadlock, chain deadlock, lock queue         |

## Tech Stack

| Layer    | Technology                   |
| -------- | ---------------------------- |
| Frontend | React 19, Vite, Zustand      |
| UI       | Shadcn/ui, Tailwind, Monaco  |
| Backend  | NestJS, Socket.io            |
| Database | PostgreSQL 16, node-postgres |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview and [docs/adr/](./docs/adr/) for key design decisions.

```
Frontend (React + Zustand)
        │
        │ WebSocket
        ▼
Backend (NestJS)
        │
        │ 3 dedicated connections
        ▼
PostgreSQL 16
```

## Project Structure

```
├── apps/
│   ├── backend/     # NestJS WebSocket server
│   └── frontend/    # React SPA
├── packages/
│   └── shared/      # TypeScript types, DB schema
└── docs/
    └── adr/         # Architecture Decision Records
```

## Development

```bash
pnpm dev           # Start all (backend + frontend)
pnpm dev:backend   # Backend only (port 3000)
pnpm dev:frontend  # Frontend only (port 5173)
pnpm test          # Run all tests (110 tests)
pnpm lint          # ESLint
pnpm build         # Production build
```

## Roadmap

Potential future improvements:

- **Public deployment** — room-based sessions with connection limits for multi-user access
- **Lock visualization** — real-time pg_locks display showing which transactions hold/wait for locks
- **Uncommitted data view** — see pending changes before commit
- **Multi-database support** — MySQL, MariaDB isolation level comparison
- **PostgreSQL version selector** — compare behavior across PG 14/15/16/17/18
- **Custom schemas** — load user-defined SQL files for experimentation

## License

MIT
