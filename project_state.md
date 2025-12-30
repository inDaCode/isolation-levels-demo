# Isolation Levels Demo — Состояние проекта

## Что сделано

### Backend (NestJS) — готов

- WebSocket gateway для управления SQL сессиями
- `SessionManagerService` — управление PostgreSQL подключениями
- Каждый терминал = отдельная PG сессия с собственным isolation level
- События: create/execute/commit/rollback/setIsolation
- Setup endpoint для сброса схемы БД
- Broadcast committed данных после каждого commit

### Frontend (React + Vite) — базовый функционал

- Два терминала с Monaco Editor
- Выбор isolation level для каждого терминала
- Выполнение SQL, commit, rollback
- Отображение результатов запросов
- Панель Committed Data — показывает актуальное состояние БД
- Auto-setup схемы при загрузке + кнопка Reset DB

### Shared (TypeScript types)

- Типы для WebSocket событий
- `SETUP_SQL` — единый источник схемы БД
- ESM формат, используется обоими приложениями

## Структура

```
isolation-levels-demo/
├── apps/
│   ├── backend/           # NestJS, WebSocket, node-postgres
│   │   └── src/
│   │       ├── database/  # SessionManagerService
│   │       └── gateway/   # TerminalGateway
│   └── frontend/          # React, Vite, Tailwind, shadcn/ui
│       └── src/
│           ├── components/
│           │   ├── layout/        # Header
│           │   ├── terminal/      # TerminalPanel, QueryResultView
│           │   └── database-state/# DatabaseState
│           ├── hooks/             # useSocket, useSession, useDatabaseSetup, useCommittedData
│           └── lib/               # socket-client
├── packages/
│   └── shared/            # @isolation-demo/shared — типы, SETUP_SQL
└── docker-compose.yml     # PostgreSQL 16
```

## Как запустить

```bash
docker-compose up -d        # PostgreSQL на порту 5435
pnpm install
pnpm dev                    # Backend :3000, Frontend :5173
```

## Что осталось сделать (по приоритету)

1. **Explanation panel** — контекстные подсказки что происходит
2. **Scenarios режим** — пошаговые демонстрации isolation phenomena
3. **UX polish** — resizable панели, горячие клавиши (Ctrl+Enter = Run)
4. **Тесты** — unit для SessionManagerService, integration для gateway
5. **CI** — GitHub Actions (lint + test + build)

## Ключевые решения

- **Один WebSocket, несколько сессий** — sessionId связывает запрос с PG подключением
- **ESM everywhere** — shared пакет в ESM, backend переведён на ESM
- **Auto-reset при старте** — пользователь сразу видит данные
- **Committed Data обновляется автоматически** — broadcast после каждого commit

## Известные ограничения

- Нет reconnect логики при потере сессии (рефреш страницы)
- Нет валидации SQL на фронте
- Scenarios ещё не реализованы
