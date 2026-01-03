# PostgreSQL Isolation Levels Demo

An interactive educational tool for understanding PostgreSQL transaction isolation levels. Run three parallel SQL sessions and observe how different isolation levels affect data visibility and locking behavior.

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

- **Three SQL Terminals** — Independent database sessions for complex scenarios
- **Real-time Results** — See query results instantly via WebSocket
- **Isolation Level Selector** — Switch levels with detailed explanations
- **Committed Data View** — Always see the actual committed state with change highlighting
- **SQL Presets** — Quick access to common SELECT, UPDATE, and LOCK queries
- **Guided Scenarios** — Step-by-step demos of isolation phenomena
- **Transaction Controls** — Visual feedback for BEGIN/COMMIT/ROLLBACK state

## 🎮 Scenarios

### Basic

| Scenario            | What It Shows                                         |
| ------------------- | ----------------------------------------------------- |
| Non-repeatable Read | Same SELECT returns different data in one transaction |

### Intermediate

| Scenario | What It Shows                                         |
| -------- | ----------------------------------------------------- |
| Deadlock | Two transactions block each other, PostgreSQL detects |

### Advanced (Coming Soon)

| Scenario       | What It Shows                                  |
| -------------- | ---------------------------------------------- |
| Chain Deadlock | Three-way circular lock (requires 3 terminals) |
| Lock Queue     | One slow transaction blocks everyone           |
| Lost Update    | Concurrent updates without FOR UPDATE          |

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Shadcn/ui, Monaco Editor
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
│   │   └── src/
│   │       ├── database/ # Session management
│   │       └── gateway/  # WebSocket handlers
│   └── frontend/         # React application
│       └── src/
│           ├── components/
│           │   ├── terminal/       # SQL editor, presets, results
│           │   ├── scenario/       # Guided scenario UI
│           │   └── database-state/ # Committed data display
│           ├── data/               # Scenario definitions
│           └── hooks/              # State management
├── packages/
│   └── shared/           # Shared TypeScript types
├── docker-compose.yml    # PostgreSQL setup
└── pnpm-workspace.yaml
```

## 🔌 WebSocket API

| Event                  | Direction       | Description                 |
| ---------------------- | --------------- | --------------------------- |
| `session:create`       | Client → Server | Create new database session |
| `session:execute`      | Client → Server | Execute SQL query           |
| `session:commit`       | Client → Server | Commit transaction          |
| `session:rollback`     | Client → Server | Rollback transaction        |
| `session:setIsolation` | Client → Server | Change isolation level      |
| `data:committed`       | Server → Client | Broadcast committed data    |
| `setup:execute`        | Client → Server | Reset database schema       |

## 🎨 UI Features

- **Dark theme** optimized for focus
- **Change highlighting** — yellow for modified cells, green for new rows
- **Transaction indicator** — visual state in each terminal
- **Activity log** — last 3 actions with timestamps
- **Keyboard shortcuts** — Ctrl+Enter to execute query

## 📄 License

MIT © inDaCode

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines first.
