# Isolation Levels Demo — Состояние проекта

## Что сделано

### Backend (NestJS)

- WebSocket gateway для управления SQL сессиями
- `SessionManagerService` — управление PostgreSQL подключениями
- Каждый терминал = отдельная PG сессия с собственным isolation level
- События: create/execute/commit/rollback/setIsolation
- Setup endpoint для сброса схемы БД
- Broadcast committed данных после каждого commit и autocommit
- Явное управление транзакциями (BEGIN открывает, COMMIT/ROLLBACK закрывает)

### Frontend (React + Vite)

- **3 терминала** с Monaco Editor (для демонстрации chain deadlock и других сценариев)
- **Zustand store** для централизованного управления сессиями
- Выбор isolation level с описаниями (dropdown с пояснениями)
- SQL presets toolbar (SELECT, UPDATE, LOCK категории) — вертикально слева от редактора
- Выполнение SQL, BEGIN, Commit, Rollback
- Activity log в каждом терминале (последние 3 записи, с timestamp, цветовая индикация)
- Loading state (спиннер, readonly editor во время выполнения)
- Ctrl+Enter для выполнения запроса
- Панель Committed Data с подсветкой изменений + кнопка Reset DB
- **Scenario Mode:**
  - Выбор сценария из dropdown в Header
  - ScenarioPanel с пошаговыми инструкциями
  - Кнопки Copy и Run для копирования/выполнения SQL
  - Навигация по шагам (Back / Next)
  - Conclusion с описанием проблемы и решения
- **ExplanationPanel** в режиме Sandbox (welcome message)

### Shared (TypeScript types)

- Типы для WebSocket событий
- Типы для сценариев (`Scenario`, `ScenarioStep`)
- `SETUP_SQL` — единый источник схемы БД
- ESM формат, используется обоими приложениями

## Структура

```
isolation-levels-demo/
├── apps/
│   ├── backend/              # NestJS, WebSocket, node-postgres
│   │   └── src/
│   │       ├── database/     # SessionManagerService
│   │       └── gateway/      # TerminalGateway
│   └── frontend/             # React, Vite, Tailwind, shadcn/ui
│       └── src/
│           ├── components/
│           │   ├── layout/         # Header
│           │   ├── terminal/       # TerminalPanel, QueryResultView, SqlPresets, IsolationSelect
│           │   ├── database-state/ # DatabaseState
│           │   ├── explanation/    # ExplanationPanel
│           │   └── scenario/       # ScenarioSelect, ScenarioPanel
│           ├── stores/             # session-store.ts (Zustand)
│           ├── data/               # scenarios.ts (данные сценариев)
│           ├── hooks/              # useSocket, useDatabaseSetup, useCommittedData, useScenario
│           └── lib/                # socket-client
├── packages/
│   └── shared/               # @isolation-demo/shared — типы, SETUP_SQL
└── docker-compose.yml        # PostgreSQL 16
```

## Как запустить

```bash
docker-compose up -d        # PostgreSQL на порту 5435
pnpm install
pnpm dev                    # Backend :3000, Frontend :5173
```

## Сценарии (реализованы)

| Сценарий            | Терминалов | Сложность    | Описание                                           |
| ------------------- | ---------- | ------------ | -------------------------------------------------- |
| Non-repeatable Read | 2          | Basic        | SELECT возвращает разные данные в одной транзакции |
| Deadlock            | 2          | Intermediate | Взаимная блокировка двух транзакций                |

## Что осталось сделать (по приоритету)

1. **Добавить больше сценариев:**
   - Phantom Read
   - Lost Update + защита с FOR UPDATE
   - Chain Deadlock (3 терминала)
   - Lock Queue (3 терминала)
2. **Тесты** — unit для session-store, integration для gateway
3. **CI** — GitHub Actions (lint + test + build)

## Ключевые решения

- **Zustand для session state** — централизованное управление, ScenarioPanel и TerminalPanel работают с одним store без prop drilling и refs
- **Один WebSocket, несколько сессий** — sessionId связывает запрос с PG подключением
- **ESM everywhere** — shared пакет в ESM, backend переведён на ESM
- **Auto-reset при старте** — пользователь сразу видит данные
- **Committed Data обновляется автоматически** — broadcast после commit и autocommit
- **Явные транзакции** — BEGIN обязателен для старта транзакции, без него запросы в autocommit
- **Activity log в store** — логирование инкапсулировано в session-store
- **Типы сценариев в shared, данные на фронте** — правильное разделение для монорепы
- **3 терминала** — для демонстрации chain deadlock и lock queue

## Отложенные идеи (v2)

- **Uncommitted data view** — показывать незакоммиченные изменения
- **Lock visualization** — показывать ожидание блокировок через pg_locks

## Известные ограничения

- Нет reconnect логики при потере сессии (рефреш страницы)
- Нет валидации SQL на фронте
