import { create } from 'zustand';
import { socket } from '@/lib/socket-client';
import {
  WS_EVENTS,
  type SessionState,
  type QueryResult,
  type QueryError,
  type IsolationLevel,
  type SessionCreatedEvent,
  type QueryResultEvent,
  type SessionOperationResult,
  type UncommittedSnapshot,
  type TerminalId,
} from '@isolation-demo/shared';

// --- Types ---

export interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface TerminalSession {
  state: SessionState | null;
  sql: string;
  lastResult: QueryResult | null;
  lastError: QueryError | null;
  lastWasTransactionCommand: boolean;
  log: LogEntry[];
  isLoading: boolean;
}

export type UncommittedData = Record<TerminalId, UncommittedSnapshot | null>;

interface SessionStore {
  sessions: Record<TerminalId, TerminalSession>;
  uncommitted: UncommittedData;

  setSql: (terminalId: TerminalId, sql: string) => void;
  createSession: (terminalId: TerminalId, isolationLevel?: IsolationLevel) => Promise<void>;
  execute: (terminalId: TerminalId) => Promise<void>;
  executeWithSql: (terminalId: TerminalId, sql: string) => Promise<void>;
  commit: (terminalId: TerminalId) => Promise<void>;
  rollback: (terminalId: TerminalId) => Promise<void>;
  setIsolationLevel: (terminalId: TerminalId, level: IsolationLevel) => Promise<void>;
  clearUncommitted: (terminalId: TerminalId) => void;
}

// --- Constants ---

const MAX_LOG_ENTRIES = 10;
const TRANSACTION_COMMANDS = new Set([
  'BEGIN',
  'BEGIN;',
  'COMMIT',
  'COMMIT;',
  'ROLLBACK',
  'ROLLBACK;',
]);
const DEFAULT_SQL = 'SELECT * FROM accounts;';

const createInitialSession = (): TerminalSession => ({
  state: null,
  sql: DEFAULT_SQL,
  lastResult: null,
  lastError: null,
  lastWasTransactionCommand: false,
  log: [],
  isLoading: false,
});

// --- Helpers ---

function isTransactionCommand(sql: string): boolean {
  return TRANSACTION_COMMANDS.has(sql.trim().toUpperCase());
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatQueryLog(sql: string, result: QueryResult): string {
  const preview = sql.trim().slice(0, 25) + (sql.length > 25 ? '...' : '');
  return `${preview} → ${result.rowCount} rows, ${result.duration}ms`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

// --- Store ---

export const useSessionStore = create<SessionStore>((set, get) => {
  let logId = 0;

  const updateSession = (terminalId: TerminalId, updates: Partial<TerminalSession>) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [terminalId]: { ...state.sessions[terminalId], ...updates },
      },
    }));
  };

  const updateUncommitted = (terminalId: TerminalId, data: UncommittedSnapshot | null) => {
    set((state) => ({
      uncommitted: {
        ...state.uncommitted,
        [terminalId]: data,
      },
    }));
  };

  const addLog = (terminalId: TerminalId, message: string, type: LogEntry['type'] = 'info') => {
    const session = get().sessions[terminalId];
    const newLog = [
      ...session.log.slice(-(MAX_LOG_ENTRIES - 1)),
      { id: logId++, timestamp: formatTime(), message, type },
    ];
    updateSession(terminalId, { log: newLog });
  };

  return {
    sessions: {
      1: createInitialSession(),
      2: createInitialSession(),
      3: createInitialSession(),
    },
    uncommitted: {
      1: null,
      2: null,
      3: null,
    },

    setSql: (terminalId, sql) => {
      updateSession(terminalId, { sql });
    },

    createSession: async (terminalId, isolationLevel) => {
      updateSession(terminalId, { isLoading: true });

      try {
        const response: SessionCreatedEvent = await socket.emitWithAck(WS_EVENTS.SESSION_CREATE, {
          terminalId,
          isolationLevel,
        });
        updateSession(terminalId, { state: response.state, isLoading: false });
        addLog(terminalId, 'Session created', 'info');
      } catch (error) {
        updateSession(terminalId, { isLoading: false });
        addLog(terminalId, getErrorMessage(error), 'error');
      }
    },

    execute: async (terminalId) => {
      const session = get().sessions[terminalId];
      if (!session.state) return;

      const sql = session.sql;
      if (!sql.trim()) return;

      const isTxCommand = isTransactionCommand(sql);
      updateSession(terminalId, {
        isLoading: true,
        lastError: null,
        lastWasTransactionCommand: isTxCommand,
      });

      try {
        const response: QueryResultEvent = await socket.emitWithAck(WS_EVENTS.SESSION_EXECUTE, {
          sessionId: session.state.sessionId,
          sql,
        });

        // Update uncommitted data (store entire snapshot)
        if (response.uncommitted) {
          updateUncommitted(response.uncommitted.terminalId, response.uncommitted);
        } else if (!response.state?.inTransaction) {
          // Clear uncommitted when transaction ends
          updateUncommitted(terminalId, null);
        }

        if (response.error) {
          updateSession(terminalId, {
            lastError: response.error,
            lastResult: null,
            state: response.state ?? session.state,
            isLoading: false,
          });
          addLog(terminalId, response.error.message, 'error');
          return;
        }

        if (response.result) {
          updateSession(terminalId, {
            lastResult: response.result,
            state: response.state ?? session.state,
            isLoading: false,
          });

          const sqlUpper = sql.trim().toUpperCase();
          if (sqlUpper === 'BEGIN' || sqlUpper === 'BEGIN;') {
            const level = response.state?.isolationLevel ?? session.state.isolationLevel;
            addLog(terminalId, `BEGIN (${level})`, 'success');
          } else if (sqlUpper === 'COMMIT' || sqlUpper === 'COMMIT;') {
            addLog(terminalId, 'COMMIT ✓', 'success');
          } else if (sqlUpper === 'ROLLBACK' || sqlUpper === 'ROLLBACK;') {
            addLog(terminalId, 'ROLLBACK', 'warning');
          } else {
            addLog(terminalId, formatQueryLog(sql, response.result), 'info');
          }
        }
      } catch (error) {
        updateSession(terminalId, { isLoading: false });
        addLog(terminalId, getErrorMessage(error), 'error');
      }
    },

    executeWithSql: async (terminalId, sql) => {
      get().setSql(terminalId, sql);
      return get().execute(terminalId);
    },

    commit: async (terminalId) => {
      const session = get().sessions[terminalId];
      if (!session.state) return;

      updateSession(terminalId, { isLoading: true, lastWasTransactionCommand: true });

      try {
        const response: SessionOperationResult = await socket.emitWithAck(
          WS_EVENTS.SESSION_COMMIT,
          { sessionId: session.state.sessionId },
        );

        // Clear uncommitted on commit
        updateUncommitted(terminalId, null);

        if (response.state) {
          updateSession(terminalId, {
            state: response.state,
            lastResult: null,
            isLoading: false,
          });
          addLog(terminalId, 'COMMIT ✓', 'success');
        } else if (response.error) {
          updateSession(terminalId, {
            lastError: { message: response.error },
            isLoading: false,
          });
          addLog(terminalId, response.error, 'error');
        }
      } catch (error) {
        updateSession(terminalId, { isLoading: false });
        addLog(terminalId, getErrorMessage(error), 'error');
      }
    },

    rollback: async (terminalId) => {
      const session = get().sessions[terminalId];
      if (!session.state) return;

      updateSession(terminalId, { isLoading: true, lastWasTransactionCommand: true });

      try {
        const response: SessionOperationResult = await socket.emitWithAck(
          WS_EVENTS.SESSION_ROLLBACK,
          { sessionId: session.state.sessionId },
        );

        // Clear uncommitted on rollback
        updateUncommitted(terminalId, null);

        if (response.state) {
          updateSession(terminalId, {
            state: response.state,
            lastResult: null,
            isLoading: false,
          });
          addLog(terminalId, 'ROLLBACK', 'warning');
        } else if (response.error) {
          updateSession(terminalId, {
            lastError: { message: response.error },
            isLoading: false,
          });
          addLog(terminalId, response.error, 'error');
        }
      } catch (error) {
        updateSession(terminalId, { isLoading: false });
        addLog(terminalId, getErrorMessage(error), 'error');
      }
    },

    setIsolationLevel: async (terminalId, level) => {
      const session = get().sessions[terminalId];
      if (!session.state) return;

      try {
        const response: SessionOperationResult = await socket.emitWithAck(
          WS_EVENTS.SESSION_SET_ISOLATION,
          { sessionId: session.state.sessionId, level },
        );

        if (response.state) {
          updateSession(terminalId, { state: response.state });
          addLog(terminalId, `Isolation → ${level}`, 'info');
        } else if (response.error) {
          updateSession(terminalId, { lastError: { message: response.error } });
          addLog(terminalId, response.error, 'error');
        }
      } catch (error) {
        addLog(terminalId, getErrorMessage(error), 'error');
      }
    },

    clearUncommitted: (terminalId) => {
      updateUncommitted(terminalId, null);
    },
  };
});

// --- Selectors ---

export const selectSession = (terminalId: TerminalId) => (state: SessionStore) =>
  state.sessions[terminalId];

export const selectUncommitted = (state: SessionStore) => state.uncommitted;
