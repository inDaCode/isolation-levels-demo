# Isolation Levels Demo

Interactive tool for learning PostgreSQL transaction isolation levels through hands-on experimentation.

## Why This Exists

Most resources explain isolation levels with text and diagrams. This tool lets you **run real transactions** and **see the differences** — dirty reads, phantom reads, deadlocks, and more.

Three terminals allow demonstrating scenarios that require multiple participants: chain deadlocks (A→B→C→A), lock queues, and concurrent updates.

## Features

- **3 independent SQL terminals** with separate PostgreSQL connections
- **15 guided scenarios** covering read anomalies, write anomalies, locks, and deadlocks
- **Real-time database state** with committed data and pending changes visualization
- **Uncommitted data preview** — see what each terminal will commit (color-coded)
- **Smart change tracking** — only shows rows actually modified, not stale reads
- **Isolation level selector** per terminal (READ UNCOMMITTED → SERIALIZABLE)
- **Auto-setup** — isolation levels configured automatically for each scenario

## Quick Start

```bash
# Prerequisites: Docker, Node.js 20+, pnpm 10+

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

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | React 19, Vite, Zustand            |
| UI       | Shadcn/ui, Tailwind, Monaco Editor |
| Backend  | NestJS, Socket.io (typed)          |
| Database | PostgreSQL 16, node-postgres       |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview and [docs/adr/](./docs/adr/) for key design decisions.

```
Frontend (React + Zustand)
        │
        │ WebSocket (typed)
        ▼
Backend (NestJS)
        │
        │ 3 dedicated + 1 utility connection
        ▼
PostgreSQL 16
```

## Project Structure

```
├── apps/
│   ├── backend/     # NestJS WebSocket server
│   └── frontend/    # React SPA
├── packages/
│   └── shared/      # TypeScript types, WebSocket protocol
└── docs/
    └── adr/         # Architecture Decision Records
```

## Development

```bash
pnpm dev           # Start all (backend + frontend)
pnpm dev:backend   # Backend only (port 3000)
pnpm dev:frontend  # Frontend only (port 5173)
pnpm test          # Run all tests
pnpm lint          # ESLint
pnpm build         # Production build
```

## Roadmap

Potential future improvements:

- **Public deployment** — room-based sessions with connection limits
- **Lock visualization** — real-time pg_locks display showing which transactions hold/wait
- **Multi-database support** — MySQL, MariaDB isolation level comparison
- **PostgreSQL version selector** — compare behavior across PG 14/15/16/17/18
- **Custom schemas** — load user-defined SQL files for experimentation

## License

MIT
