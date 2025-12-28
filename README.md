# PostgreSQL Isolation Levels Demo

An interactive educational tool for understanding PostgreSQL transaction isolation levels. Run two parallel SQL sessions and observe how different isolation levels affect data visibility.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🎯 What You'll Learn

| Isolation Level  | Dirty Read | Non-repeatable Read | Phantom Read |
| ---------------- | ---------- | ------------------- | ------------ |
| Read Uncommitted | Possible\* | Possible            | Possible     |
| Read Committed   | No         | Possible            | Possible     |
| Repeatable Read  | No         | No                  | No\*\*       |
| Serializable     | No         | No                  | No           |

\*PostgreSQL treats Read Uncommitted as Read Committed  
\*\*PostgreSQL's Repeatable Read also prevents phantom reads

## ✨ Features

- **Dual SQL Terminals** — Two independent database sessions side by side
- **Real-time Results** — See query results instantly via WebSocket
- **Isolation Level Selector** — Switch levels and observe behavior changes
- **Committed Data View** — Always see the actual committed state
- **Preset Scenarios** — One-click demos for common isolation phenomena

## 🛠 Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Shadcn/ui, Monaco Editor
- **Backend:** NestJS, TypeScript, Socket.io, node-postgres
- **Database:** PostgreSQL 16
- **Monorepo:** pnpm workspaces

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/isolation-levels-demo.git
cd isolation-levels-demo

# Install dependencies
pnpm install

# Start PostgreSQL
docker-compose up -d

# Start development servers
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📁 Project Structure

```
isolation-levels-demo/
├── apps/
│   ├── backend/          # NestJS WebSocket server
│   └── frontend/         # React application
├── packages/
│   └── shared/           # Shared TypeScript types
├── docker-compose.yml    # PostgreSQL setup
└── pnpm-workspace.yaml
```

## 🎮 Demo Scenarios

### 1. Dirty Read

See why Read Committed prevents reading uncommitted changes.

### 2. Non-repeatable Read

Same SELECT, different results — observe with Repeatable Read vs Read Committed.

### 3. Phantom Read

Watch row counts change between queries.

### 4. Lost Update

Two sessions update the same row — see how Serializable prevents conflicts.

## 🔌 API

WebSocket events for session management:

| Event                  | Direction       | Description                 |
| ---------------------- | --------------- | --------------------------- |
| `session:create`       | Client → Server | Create new database session |
| `session:execute`      | Client → Server | Execute SQL query           |
| `session:commit`       | Client → Server | Commit transaction          |
| `session:rollback`     | Client → Server | Rollback transaction        |
| `session:setIsolation` | Client → Server | Change isolation level      |
| `data:committed`       | Server → Client | Broadcast committed data    |

## 📄 License

MIT © inDaCode

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines first.
